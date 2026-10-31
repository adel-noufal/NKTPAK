"""
NxtPak AI — Packaging Optimization Engine
Deterministic, testable code for generating and ranking packaging alternatives.
Never LLM-only. Records all assumptions and formulas explicitly.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from app.schemas.schemas import (
    AlternativeRank,
    BaselinePackaging,
    CostBreakdown,
    DataLabel,
    MaterialUsage,
    OptimizationConfig,
    OptimizationResult,
    PackagingAlternative,
    SavingsMetrics,
)

logger = logging.getLogger(__name__)


def compute_carton_board_area_cm2(outer_L: float, outer_W: float, outer_H: float) -> float:
    """
    Compute total surface area of standard 6-sided outer carton (RSC regular slotted carton approx)
    Surface area = 2 * (L*W + L*H + W*H) in cm²
    Dimensions passed are in mm.
    """
    area_mm2 = 2.0 * (outer_L * outer_W + outer_L * outer_H + outer_W * outer_H)
    return area_mm2 / 100.0  # mm² to cm²


def compute_board_volume_cm3(area_cm2: float, board_thickness_mm: float) -> float:
    """Board volume in cm³ = area_cm2 * (thickness_mm / 10)."""
    return area_cm2 * (board_thickness_mm / 10.0)


class OptimizationEngine:
    """
    Deterministic packaging engine generating 3 candidate alternatives:
    1. Tight Fit (Min Clearance)
    2. Standard Fit (Recommended - Balanced Protection & Volume)
    3. Protective Fit (Generous Clearance + Inserts)
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
        baseline: Optional[BaselinePackaging] = None,
        config: Optional[OptimizationConfig] = None,
    ) -> OptimizationResult:
        cfg = config or self.config

        p_L = product_dims_mm["L"]
        p_W = product_dims_mm["W"]
        p_H = product_dims_mm["H"]
        product_vol_mm3 = p_L * p_W * p_H

        baseline_material_cm3: Optional[float] = None
        baseline_cost_per_unit: Optional[float] = None
        if baseline:
            b_area = compute_carton_board_area_cm2(
                baseline.carton_outer_length_mm,
                baseline.carton_outer_width_mm,
                baseline.carton_outer_height_mm,
            )
            b_board_vol = compute_board_volume_cm3(b_area, baseline.board_thickness_mm)
            b_insert_vol = sum(ins.volume_cm3 or 0.0 for ins in baseline.inserts)
            baseline_material_cm3 = b_board_vol + b_insert_vol
            baseline_cost_per_unit = baseline.total_cost_per_unit

        assumptions = [
            f"Corrugated board thickness assumed as {cfg.board_thickness_mm} mm for alternatives.",
            "Carton format assumed as Regular Slotted Container (RSC) style with standard overlap.",
            f"Cushioning/insert perimeter thickness assumed as {cfg.insert_thickness_mm} mm for protective alternative.",
            "Volume utilization = product_volume_mm³ / internal_packaging_volume_mm³.",
            "All savings percentages computed strictly against user-entered baseline (or marked NOT_CONFIGURED).",
        ]

        alternatives: list[PackagingAlternative] = []

        # Alt 1: Tight Fit
        alt1 = self._build_alternative(
            name="Tight Fit (Material-Optimized)",
            description="Minimal clearance for sturdy products or secondary display packs.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            clearance_mm=cfg.min_clearance_mm,
            board_th_mm=cfg.board_thickness_mm,
            insert_th_mm=0.0,
            insert_desc="None (Direct pack with surface contact)",
            baseline_material_cm3=baseline_material_cm3,
            baseline_cost=baseline_cost_per_unit,
            currency=baseline.currency if baseline else None,
            rank_label=AlternativeRank.ALTERNATIVE,
            assumptions=[
                f"Applies minimum side clearance of {cfg.min_clearance_mm} mm.",
                "Suitable only for robust non-fragile items.",
            ],
        )
        alternatives.append(alt1)

        # Alt 2: Standard Fit (Recommended)
        alt2 = self._build_alternative(
            name="Standard Fit (Balanced Protection)",
            description="Standard industrial clearance balancing volume utilization and impact clearance.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            clearance_mm=cfg.standard_clearance_mm,
            board_th_mm=cfg.board_thickness_mm,
            insert_th_mm=0.0,
            insert_desc="Light edge/corner pads (included in clearance)",
            baseline_material_cm3=baseline_material_cm3,
            baseline_cost=baseline_cost_per_unit,
            currency=baseline.currency if baseline else None,
            rank_label=AlternativeRank.RECOMMENDED,
            assumptions=[
                f"Applies standard industrial clearance of {cfg.standard_clearance_mm} mm per face.",
                "Optimal balance of material economy and drop protection for general logistics.",
            ],
        )
        alternatives.append(alt2)

        # Alt 3: Protective Fit
        alt3 = self._build_alternative(
            name="Protective Fit (High Cushioning)",
            description="Enhanced buffer with perimeter foam / corrugated inserts for delicate goods.",
            p_L=p_L,
            p_W=p_W,
            p_H=p_H,
            product_vol_mm3=product_vol_mm3,
            clearance_mm=cfg.generous_clearance_mm,
            board_th_mm=cfg.board_thickness_mm,
            insert_th_mm=cfg.insert_thickness_mm,
            insert_desc=f"{cfg.insert_thickness_mm}mm EPE / Corrugated cushion buffer",
            baseline_material_cm3=baseline_material_cm3,
            baseline_cost=baseline_cost_per_unit,
            currency=baseline.currency if baseline else None,
            rank_label=AlternativeRank.ALTERNATIVE,
            assumptions=[
                f"Applies {cfg.generous_clearance_mm} mm clearance and {cfg.insert_thickness_mm} mm insert padding.",
                "Engineered for high fragility or severe transport distribution environments.",
            ],
        )
        alternatives.append(alt3)

        # Ranks evaluation & sorting
        self._score_and_rank(alternatives, fragility_class)

        # Find recommended alternative
        recommended = next((a for a in alternatives if a.rank == AlternativeRank.RECOMMENDED), alternatives[0])

        return OptimizationResult(
            project_id=project_id,
            product_name=product_name,
            product_volume_mm3=product_vol_mm3,
            alternatives=alternatives,
            recommended=recommended,
            baseline_included=baseline is not None,
            calculation_notes=[
                "Calculations performed deterministically via NxtPak Optimization Engine v1.",
                "Area = 2*(L*W + L*H + W*H); Board volume = Area * thickness.",
                "Volume utilization = product_volume_mm³ / internal_packaging_volume_mm³.",
            ],
            assumptions=assumptions,
            result_label="PRELIMINARY GEOMETRIC PROTOTYPE — for engineering review only",
            result_warning=(
                "These are deterministic geometric estimates. "
                "Protective adequacy has NOT been verified. "
                "Physical testing is required before production use."
            ),
        )

    def _build_alternative(
        self,
        name: str,
        description: str,
        p_L: float,
        p_W: float,
        p_H: float,
        product_vol_mm3: float,
        clearance_mm: float,
        board_th_mm: float,
        insert_th_mm: float,
        insert_desc: str,
        baseline_material_cm3: Optional[float],
        baseline_cost: Optional[float],
        currency: Optional[str],
        rank_label: AlternativeRank,
        assumptions: list[str],
    ) -> PackagingAlternative:
        # Cavity dims needed around product
        inner_L = p_L + 2.0 * (clearance_mm + insert_th_mm)
        inner_W = p_W + 2.0 * (clearance_mm + insert_th_mm)
        inner_H = p_H + 2.0 * (clearance_mm + insert_th_mm)

        # Outer box dimensions
        outer_L = inner_L + 2.0 * board_th_mm
        outer_W = inner_W + 2.0 * board_th_mm
        outer_H = inner_H + 2.0 * board_th_mm

        inner_vol_mm3 = inner_L * inner_W * inner_H
        vol_util = min(1.0, max(0.0, product_vol_mm3 / inner_vol_mm3)) if inner_vol_mm3 > 0 else 0.0

        board_area_cm2 = compute_carton_board_area_cm2(outer_L, outer_W, outer_H)
        board_vol_cm3 = compute_board_volume_cm3(board_area_cm2, board_th_mm)

        # Perimeter insert volume estimate (if inserts present)
        insert_vol_cm3 = 0.0
        if insert_th_mm > 0:
            total_cavity_vol_cm3 = inner_vol_mm3 / 1000.0
            prod_plus_clear_vol_cm3 = ((p_L + 2 * clearance_mm) * (p_W + 2 * clearance_mm) * (p_H + 2 * clearance_mm)) / 1000.0
            insert_vol_cm3 = max(0.0, total_cavity_vol_cm3 - prod_plus_clear_vol_cm3)

        total_mat_vol_cm3 = board_vol_cm3 + insert_vol_cm3

        mat_usage = MaterialUsage(
            carton_board_area_cm2=round(board_area_cm2, 2),
            carton_board_volume_cm3=round(board_vol_cm3, 2),
            insert_volume_cm3=round(insert_vol_cm3, 2),
            total_material_volume_cm3=round(total_mat_vol_cm3, 2),
            label=DataLabel.ESTIMATE,
            formula_notes="Carton Area: 2*(L*W + L*H + W*H) [cm²]; Board Vol: Area * thickness; Insert Vol: cavity perimeter.",
        )

        # Savings vs baseline
        mat_saved_pct: Optional[float] = None
        mat_saved_cm3: Optional[float] = None
        cost_saved: Optional[float] = None
        cost_saved_pct: Optional[float] = None
        savings_status = "NOT_CONFIGURED"

        if baseline_material_cm3 is not None and baseline_material_cm3 > 0:
            mat_saved_cm3 = round(baseline_material_cm3 - total_mat_vol_cm3, 2)
            mat_saved_pct = round(((baseline_material_cm3 - total_mat_vol_cm3) / baseline_material_cm3) * 100.0, 2)
            savings_status = "CALCULATED"

        # Baseline cost calculation
        cost_status = "NOT_CONFIGURED"
        estimated_cost: Optional[float] = None
        if baseline_cost is not None and baseline_material_cm3 is not None and baseline_material_cm3 > 0:
            # Pro-rate packaging cost by material volume proportion
            mat_ratio = total_mat_vol_cm3 / baseline_material_cm3
            estimated_cost = round(baseline_cost * mat_ratio, 2)
            cost_saved = round(baseline_cost - estimated_cost, 2)
            cost_saved_pct = round((cost_saved / baseline_cost) * 100.0, 2)
            cost_status = "ESTIMATED_FROM_BASELINE"

        cost_breakdown = CostBreakdown(
            carton_cost=round(estimated_cost * 0.7, 2) if estimated_cost is not None else None,
            insert_cost=round(estimated_cost * 0.3, 2) if (estimated_cost is not None and insert_th_mm > 0) else 0.0,
            total_cost=estimated_cost,
            currency=currency,
            cost_label=DataLabel.ESTIMATE if estimated_cost is not None else DataLabel.USER_ENTERED,
            cost_status=cost_status,
        )

        savings_metrics = SavingsMetrics(
            volume_utilization=round(vol_util, 4),
            volume_utilization_pct=round(vol_util * 100.0, 2),
            material_saved_pct=mat_saved_pct,
            material_saved_cm3=mat_saved_cm3,
            cost_saved=cost_saved,
            cost_saved_pct=cost_saved_pct,
            currency=currency,
            savings_label=DataLabel.ESTIMATE,
            baseline_available=baseline_material_cm3 is not None,
            savings_status=savings_status,
        )

        return PackagingAlternative(
            alternative_id=str(uuid.uuid4()),
            name=name,
            description=description,
            rank=rank_label,
            outer_length_mm=round(outer_L, 1),
            outer_width_mm=round(outer_W, 1),
            outer_height_mm=round(outer_H, 1),
            board_thickness_mm=round(board_th_mm, 1),
            inner_length_mm=round(inner_L, 1),
            inner_width_mm=round(inner_W, 1),
            inner_height_mm=round(inner_H, 1),
            clearance_length_mm=round(clearance_mm, 1),
            clearance_width_mm=round(clearance_mm, 1),
            clearance_height_mm=round(clearance_mm, 1),
            insert_thickness_mm=round(insert_th_mm, 1),
            insert_description=insert_desc,
            material_usage=mat_usage,
            savings=savings_metrics,
            cost=cost_breakdown,
            ranking_score=0.0,
            ranking_criteria={},
            assumptions=assumptions,
            data_label="PRELIMINARY GEOMETRIC PROTOTYPE",
        )

    def _score_and_rank(self, alts: list[PackagingAlternative], fragility_class: str) -> None:
        """
        Rank alternatives with explicit criteria:
        - Volume utilization (weight 0.45)
        - Material efficiency (weight 0.35)
        - Fragility adequacy penalty / reward (weight 0.20)
        """
        for alt in alts:
            vol_score = alt.savings.volume_utilization

            # Fragility weighting
            protection_score = 0.5
            if fragility_class in ("HIGH", "VERY_HIGH"):
                if alt.insert_thickness_mm > 0:
                    protection_score = 0.95
                elif alt.clearance_length_mm >= 25.0:
                    protection_score = 0.65
                else:
                    protection_score = 0.25
            else:
                if alt.clearance_length_mm <= 25.0 and alt.insert_thickness_mm == 0:
                    protection_score = 0.90
                else:
                    protection_score = 0.60

            # Material savings score (or baseline relative)
            mat_score = 0.5
            if alt.savings.material_saved_pct is not None:
                mat_score = min(1.0, max(0.0, (alt.savings.material_saved_pct + 50.0) / 100.0))

            composite = 0.45 * vol_score + 0.35 * mat_score + 0.20 * protection_score
            alt.ranking_score = round(composite, 3)
            alt.ranking_criteria = {
                "volume_utilization_component": round(vol_score, 3),
                "material_efficiency_component": round(mat_score, 3),
                "protection_adequacy_component": round(protection_score, 3),
                "fragility_class_considered": fragility_class,
            }

        # Select highest composite score as RECOMMENDED
        sorted_alts = sorted(alts, key=lambda x: x.ranking_score, reverse=True)
        for i, a in enumerate(sorted_alts):
            if i == 0:
                a.rank = AlternativeRank.RECOMMENDED
            else:
                a.rank = AlternativeRank.ALTERNATIVE
