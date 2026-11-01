"""
NxtPak AI — Packaging Optimization Engine (Production).
Deterministic 3D fitting, McKee compression strength (BCT), palletization,
material, cost, and CO2 footprint calculation vs user baseline.
"""

from __future__ import annotations

import math
import logging
import uuid
from typing import Optional, List, Dict, Any

from app.schemas.schemas import (
    AlternativeRank,
    BaselinePackaging,
    CostBreakdown,
    DataLabel,
    MaterialUsage,
    McKeeCalculation,
    OptimizationConfig,
    OptimizationResult,
    PackagingAlternative,
    PalletizationResult,
    SavingsMetrics,
)

logger = logging.getLogger(__name__)

# Corrugated board properties by flute type
BOARD_PROPERTIES = {
    "B": {"ect_kn_m": 4.8, "grammage_kg_m2": 0.50, "caliper_mm": 3.0},
    "C": {"ect_kn_m": 5.6, "grammage_kg_m2": 0.58, "caliper_mm": 4.0},
    "BC": {"ect_kn_m": 7.8, "grammage_kg_m2": 0.75, "caliper_mm": 6.5},
    "EB": {"ect_kn_m": 6.2, "grammage_kg_m2": 0.62, "caliper_mm": 4.5},
    "DEFAULT": {"ect_kn_m": 5.5, "grammage_kg_m2": 0.60, "caliper_mm": 4.0},
}


def get_board_ect(board_type: str, thickness_mm: float) -> tuple[float, float]:
    """Return (ECT in kN/m, grammage in kg/m²) based on board type or thickness."""
    upper = board_type.upper()
    for key, props in BOARD_PROPERTIES.items():
        if key in upper:
            return props["ect_kn_m"], props["grammage_kg_m2"]
    # Calibrate ECT linearly from thickness if unknown flute
    est_ect = max(3.5, min(12.0, thickness_mm * 1.35))
    est_grammage = max(0.40, min(1.20, thickness_mm * 0.12))
    return round(est_ect, 2), round(est_grammage, 3)


def compute_carton_board_area_cm2(outer_L: float, outer_W: float, outer_H: float) -> float:
    """Surface area of 6-sided outer carton (RSC) in cm²."""
    area_mm2 = 2.0 * (outer_L * outer_W + outer_L * outer_H + outer_W * outer_H)
    return round(area_mm2 / 100.0, 2)


def compute_board_volume_cm3(area_cm2: float, board_thickness_mm: float) -> float:
    """Board volume in cm³ = area_cm2 * (thickness_mm / 10)."""
    return round(area_cm2 * (board_thickness_mm / 10.0), 2)


def compute_mckee_compression(
    outer_L: float,
    outer_W: float,
    outer_H: float,
    board_thickness_mm: float,
    ect_kn_m: float,
    box_gross_weight_kg: float,
    safety_factor: float = 4.5,
) -> McKeeCalculation:
    """
    Standard McKee Equation for regular slotted containers (RSC):
    BCT = 5.876 * ECT * sqrt(Perimeter * Caliper)
    Perimeter U = 2 * (L + W) in mm.
    BCT output is in Newtons (N).
    BCT_kgf = BCT / 9.80665.
    """
    perimeter_mm = 2.0 * (outer_L + outer_W)
    caliper_mm = max(1.0, board_thickness_mm)

    # McKee formula: BCT (N) = 5.876 * ECT(kN/m) * sqrt(U(mm) * d(mm))
    bct_n = 5.876 * ect_kn_m * math.sqrt(perimeter_mm * caliper_mm)
    bct_kgf = bct_n / 9.80665

    safe_load_kg = bct_kgf / safety_factor
    layers_above = math.floor(safe_load_kg / max(0.5, box_gross_weight_kg))
    max_safe_layers = max(1, layers_above + 1)

    return McKeeCalculation(
        ect_kn_m=round(ect_kn_m, 2),
        board_thickness_mm=round(board_thickness_mm, 2),
        box_perimeter_mm=round(perimeter_mm, 1),
        bct_newtons=round(bct_n, 1),
        bct_kgf=round(bct_kgf, 1),
        safety_factor=safety_factor,
        max_safe_stack_load_kg=round(safe_load_kg, 1),
        estimated_max_stack_layers=max_safe_layers,
        formula_display="BCT (N) = 5.876 × ECT(kN/m) × √(Perimeter × Thickness)",
    )


def compute_palletization(
    outer_L: float,
    outer_W: float,
    outer_H: float,
    box_gross_weight_kg: float,
    pallet_L: float = 1200.0,
    pallet_W: float = 800.0,
    max_height_mm: float = 1800.0,
) -> PalletizationResult:
    """
    Calculate pallet packing (Euro Pallet 1200x800 standard).
    Compares orientation 1 and orientation 2 for maximum pallet area utilization.
    """
    # Pattern 1: L along pallet L, W along pallet W
    p1_l = math.floor(pallet_L / max(1.0, outer_L))
    p1_w = math.floor(pallet_W / max(1.0, outer_W))
    count1 = p1_l * p1_w

    # Pattern 2: W along pallet L, L along pallet W
    p2_l = math.floor(pallet_L / max(1.0, outer_W))
    p2_w = math.floor(pallet_W / max(1.0, outer_L))
    count2 = p2_l * p2_w

    boxes_per_layer = max(1, max(count1, count2))
    layers_count = max(1, math.floor(max_height_mm / max(1.0, outer_H)))
    total_cartons = boxes_per_layer * layers_count

    pallet_area = pallet_L * pallet_W
    used_area = boxes_per_layer * (outer_L * outer_W)
    utilization_pct = min(100.0, round((used_area / pallet_area) * 100.0, 1))

    total_weight = round(total_cartons * box_gross_weight_kg + 25.0, 1)  # 25kg wooden pallet tare

    return PalletizationResult(
        pallet_type=f"Euro Pallet ({pallet_L:.0f} x {pallet_W:.0f} mm)",
        pallet_length_mm=pallet_L,
        pallet_width_mm=pallet_W,
        max_pallet_height_mm=max_height_mm,
        cartons_per_layer=boxes_per_layer,
        layers_count=layers_count,
        total_cartons_per_pallet=total_cartons,
        pallet_area_utilization_pct=utilization_pct,
        total_pallet_weight_kg=total_weight,
        stacking_pattern="Column / Interlocking Flute Aligned",
    )


class OptimizationEngine:
    """
    Production-grade packaging optimization engine.
    Generates 3 deterministic alternatives and ranks them against the user baseline.
    """

    def __init__(self, config: Optional[OptimizationConfig] = None):
        self.config = config or OptimizationConfig()

    def generate_alternatives(
        self,
        project_id: str,
        product_name: str,
        product_dims_mm: dict[str, float],
        product_weight_kg: float,
        fragility_class: str,
        baseline: BaselinePackaging,
        config: Optional[OptimizationConfig] = None,
    ) -> OptimizationResult:
        cfg = config or self.config

        p_L = product_dims_mm["L"]
        p_W = product_dims_mm["W"]
        p_H = product_dims_mm["H"]

        # Baseline parameters
        b_L = baseline.carton_outer_length_mm
        b_W = baseline.carton_outer_width_mm
        b_H = baseline.carton_outer_height_mm

        # If product is shipped knocked-down (disassembled flat-pack), the assembled envelope
        # exceeds the baseline carton. Bound the effective packed parts envelope so right-sized
        # alternatives are properly generated for the knocked-down components:
        if (p_L >= b_L or p_W >= b_W or p_H >= b_H) and (b_L > 50 and b_W > 50 and b_H > 50):
            p_L = min(p_L, max(50.0, b_L - 2 * (cfg.standard_clearance_mm + cfg.board_thickness_mm)))
            p_W = min(p_W, max(50.0, b_W - 2 * (cfg.standard_clearance_mm + cfg.board_thickness_mm)))
            p_H = min(p_H, max(50.0, b_H - 2 * (cfg.standard_clearance_mm + cfg.board_thickness_mm)))

        product_vol_mm3 = p_L * p_W * p_H
        baseline_outer_vol_liters = (b_L * b_W * b_H) / 1_000_000.0

        b_area_cm2 = compute_carton_board_area_cm2(b_L, b_W, b_H)
        b_ect, b_grammage = get_board_ect(baseline.board_type, baseline.board_thickness_mm)
        b_board_wt_kg = (b_area_cm2 / 10000.0) * b_grammage
        b_co2_kg = b_board_wt_kg * 0.95  # 0.95 kg CO2e per kg corrugated board
        baseline_cost = baseline.carton_cost_per_unit

        assumptions = [
            f"Baseline carton: {b_L} × {b_W} × {b_H} mm ({baseline_outer_vol_liters:.1f} L), Flute: {baseline.board_type}.",
            f"McKee box compression calculated with safety factor 4.5 for commercial warehousing.",
            f"Palletization optimized for Standard Euro Pallet (1200 × 800 mm, max height 1800 mm).",
            "CO₂ carbon factor: 0.95 kg CO₂e / kg corrugated board (FEFCO European corrugated database standard).",
            "Clearance dimensions are engineering assumptions and user-editable.",
        ]

        alternatives: List[PackagingAlternative] = []

        # Alt 1: Tight Fit (Material-Optimized)
        alt1 = self._build_alternative(
            name="Tight Fit (Material-Optimized)",
            description="Minimal clearance engineered for maximum material reduction and freight density.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            product_weight_kg=product_weight_kg,
            clearance_mm=cfg.min_clearance_mm,
            board_th_mm=cfg.board_thickness_mm,
            insert_th_mm=0.0,
            insert_desc="None (Direct fit with protective kraft liner)",
            baseline_area_cm2=b_area_cm2,
            baseline_cost=baseline_cost,
            baseline_co2_kg=b_co2_kg,
            currency=baseline.currency,
            rank_label=AlternativeRank.ALTERNATIVE,
            board_type="B Flute Single Wall",
            assumptions=[
                f"Applies minimum side clearance of {cfg.min_clearance_mm} mm.",
                "Engineered for high density and maximum carton count per pallet.",
            ],
        )
        alternatives.append(alt1)

        # Alt 2: Standard Balanced (Recommended)
        alt2 = self._build_alternative(
            name="Standard Fit (Balanced Protection)",
            description="Standard industrial clearance balancing impact deceleration and volume utilization.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            product_weight_kg=product_weight_kg,
            clearance_mm=cfg.standard_clearance_mm,
            board_th_mm=cfg.board_thickness_mm,
            insert_th_mm=10.0,
            insert_desc="Die-cut corrugated edge corner protectors (10mm)",
            baseline_area_cm2=b_area_cm2,
            baseline_cost=baseline_cost,
            baseline_co2_kg=b_co2_kg,
            currency=baseline.currency,
            rank_label=AlternativeRank.RECOMMENDED,
            board_type="C Flute Heavy Duty",
            assumptions=[
                f"Applies standard clearance of {cfg.standard_clearance_mm} mm per face.",
                "Optimal balance of material savings and drop deceleration for consumer appliances.",
            ],
        )
        alternatives.append(alt2)

        # Alt 3: Protective Cushion (Heavy Cushioning)
        alt3 = self._build_alternative(
            name="Protective Cushion (Fragility-Engineered)",
            description="Generous clearance with expanded perimeter cushioning for fragile electronics and appliances.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            product_weight_kg=product_weight_kg,
            clearance_mm=cfg.generous_clearance_mm,
            board_th_mm=cfg.board_thickness_mm + 2.0,  # Double wall
            insert_th_mm=cfg.insert_thickness_mm,
            insert_desc=f"{cfg.insert_thickness_mm}mm molded pulp / corrugated buffer",
            baseline_area_cm2=b_area_cm2,
            baseline_cost=baseline_cost,
            baseline_co2_kg=b_co2_kg,
            currency=baseline.currency,
            rank_label=AlternativeRank.ALTERNATIVE,
            board_type="BC Flute Double Wall",
            assumptions=[
                f"Applies {cfg.generous_clearance_mm} mm clearance and {cfg.insert_thickness_mm} mm insert padding.",
                "Engineered for high fragility items or rough intermodal freight handling.",
            ],
        )
        alternatives.append(alt3)

        # Score and rank based on fragility
        self._score_and_rank(alternatives, fragility_class)

        recommended = next((a for a in alternatives if a.rank == AlternativeRank.RECOMMENDED), alternatives[0])

        return OptimizationResult(
            project_id=project_id,
            product_name=product_name,
            product_volume_mm3=product_vol_mm3,
            baseline_outer_volume_liters=round(baseline_outer_vol_liters, 2),
            alternatives=alternatives,
            recommended=recommended,
            baseline_included=True,
            calculation_notes=[
                "Carton surface area: 2*(L*W + L*H + W*H) [cm²].",
                "McKee formula: BCT (N) = 5.876 × ECT(kN/m) × √(Perimeter × Thickness).",
                "Volume utilization = product_volume_mm³ / internal_carton_volume_mm³ × 100.",
                "Savings computed deterministically vs entered baseline.",
            ],
            assumptions=assumptions,
        )

    def _build_alternative(
        self,
        name: str,
        description: str,
        p_L: float,
        p_W: float,
        p_H: float,
        product_vol_mm3: float,
        product_weight_kg: float,
        clearance_mm: float,
        board_th_mm: float,
        insert_th_mm: float,
        insert_desc: str,
        baseline_area_cm2: float,
        baseline_cost: float,
        baseline_co2_kg: float,
        currency: str,
        rank_label: AlternativeRank,
        board_type: str,
        assumptions: list[str],
    ) -> PackagingAlternative:
        inner_L = round(p_L + 2.0 * (clearance_mm + insert_th_mm), 1)
        inner_W = round(p_W + 2.0 * (clearance_mm + insert_th_mm), 1)
        inner_H = round(p_H + 2.0 * (clearance_mm + insert_th_mm), 1)

        outer_L = round(inner_L + 2.0 * board_th_mm, 1)
        outer_W = round(inner_W + 2.0 * board_th_mm, 1)
        outer_H = round(inner_H + 2.0 * board_th_mm, 1)

        inner_vol_mm3 = inner_L * inner_W * inner_H
        vol_util = min(1.0, max(0.01, product_vol_mm3 / inner_vol_mm3)) if inner_vol_mm3 > 0 else 0.5

        board_area_cm2 = compute_carton_board_area_cm2(outer_L, outer_W, outer_H)
        board_vol_cm3 = compute_board_volume_cm3(board_area_cm2, board_th_mm)

        # Inserts volume
        insert_vol_cm3 = 0.0
        if insert_th_mm > 0:
            total_inner_vol_cm3 = inner_vol_mm3 / 1000.0
            prod_clear_cm3 = ((p_L + 2 * clearance_mm) * (p_W + 2 * clearance_mm) * (p_H + 2 * clearance_mm)) / 1000.0
            insert_vol_cm3 = max(0.0, total_inner_vol_cm3 - prod_clear_cm3)

        total_mat_vol_cm3 = board_vol_cm3 + insert_vol_cm3

        # Board weight and CO2
        ect_val, grammage_val = get_board_ect(board_type, board_th_mm)
        board_weight_kg = round((board_area_cm2 / 10000.0) * grammage_val, 3)
        co2_kg = round(board_weight_kg * 0.95, 3)

        # Real material savings vs baseline area
        mat_saved_pct = round(((baseline_area_cm2 - board_area_cm2) / baseline_area_cm2) * 100.0, 2)
        mat_saved_cm3 = round(baseline_area_cm2 - board_area_cm2, 2)

        # Cost savings proportional to area and thickness
        area_ratio = board_area_cm2 / baseline_area_cm2
        alt_cost = round(baseline_cost * area_ratio * (1.0 + (0.1 if insert_th_mm > 0 else 0.0)), 2)
        cost_saved = round(baseline_cost - alt_cost, 2)
        cost_saved_pct = round((cost_saved / baseline_cost) * 100.0, 2)
        co2_saved_kg = round(max(0.0, baseline_co2_kg - co2_kg), 3)

        gross_weight_kg = round(product_weight_kg + board_weight_kg + (insert_vol_cm3 * 0.00003), 2)

        # McKee compression & Palletization
        mckee = compute_mckee_compression(
            outer_L, outer_W, outer_H, board_th_mm, ect_val, gross_weight_kg
        )
        pallet = compute_palletization(outer_L, outer_W, outer_H, gross_weight_kg)

        mat_usage = MaterialUsage(
            carton_board_area_cm2=board_area_cm2,
            carton_board_volume_cm3=board_vol_cm3,
            insert_volume_cm3=round(insert_vol_cm3, 2),
            total_material_volume_cm3=round(total_mat_vol_cm3, 2),
            corrugated_board_weight_kg=board_weight_kg,
            co2_footprint_kg=co2_kg,
            label="CALCULATED",
            formula_notes="Area = 2*(L*W + L*H + W*H); Board Weight = Area × Grammage; CO2 = Weight × 0.95 kg/kg",
        )

        cost_breakdown = CostBreakdown(
            carton_cost=round(alt_cost * 0.85, 2),
            insert_cost=round(alt_cost * 0.15, 2) if insert_th_mm > 0 else 0.0,
            total_cost=alt_cost,
            currency=currency,
            cost_status="CALCULATED",
        )

        savings = SavingsMetrics(
            volume_utilization=round(vol_util, 4),
            volume_utilization_pct=round(vol_util * 100.0, 2),
            material_saved_pct=mat_saved_pct,
            material_saved_cm3=mat_saved_cm3,
            cost_saved=cost_saved,
            cost_saved_pct=cost_saved_pct,
            co2_saved_kg=co2_saved_kg,
            currency=currency,
            baseline_available=True,
            savings_status="CALCULATED",
            inputs_used=[
                "baseline.carton_outer_length_mm",
                "baseline.carton_outer_width_mm",
                "baseline.carton_outer_height_mm",
                "baseline.carton_cost_per_unit",
                "product.packed_dimensions",
            ],
        )

        return PackagingAlternative(
            alternative_id=str(uuid.uuid4()),
            name=name,
            description=description,
            rank=rank_label,
            outer_length_mm=outer_L,
            outer_width_mm=outer_W,
            outer_height_mm=outer_H,
            board_thickness_mm=board_th_mm,
            inner_length_mm=inner_L,
            inner_width_mm=inner_W,
            inner_height_mm=inner_H,
            clearance_length_mm=clearance_mm,
            clearance_width_mm=clearance_mm,
            clearance_height_mm=clearance_mm,
            clearance_label="ENGINEERING_ASSUMPTION",
            insert_thickness_mm=insert_th_mm,
            insert_description=insert_desc,
            material_usage=mat_usage,
            savings=savings,
            cost=cost_breakdown,
            mckee_compression=mckee,
            palletization=pallet,
            ranking_score=round(vol_util * 60.0 + max(0.0, mat_saved_pct) * 0.4, 2),
            ranking_criteria={
                "volume_utilization": vol_util,
                "material_saved_pct": mat_saved_pct,
                "cost_saved": cost_saved,
                "bct_strength_n": mckee.bct_newtons,
            },
            assumptions=assumptions,
        )

    def _score_and_rank(self, alternatives: List[PackagingAlternative], fragility_class: str) -> None:
        """Assign RECOMMENDED rank based on fragility and engineering safety factor."""
        frag = fragility_class.upper()
        for alt in alternatives:
            alt.rank = AlternativeRank.ALTERNATIVE

        if frag in ("HIGH", "VERY_HIGH"):
            # High fragility prefers Protective Cushion
            cushion_alt = next((a for a in alternatives if "Protective" in a.name), alternatives[1])
            cushion_alt.rank = AlternativeRank.RECOMMENDED
        elif frag == "LOW":
            # Low fragility prefers Tight Fit
            tight_alt = next((a for a in alternatives if "Tight" in a.name), alternatives[0])
            tight_alt.rank = AlternativeRank.RECOMMENDED
        else:
            # Medium / standard fragility prefers Standard Balanced
            std_alt = next((a for a in alternatives if "Standard" in a.name), alternatives[1])
            std_alt.rank = AlternativeRank.RECOMMENDED
