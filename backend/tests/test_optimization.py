"""
Tests for NxtPak AI Packaging Optimization Engine.
Tests volume utilization, material savings, deterministic alternative generation,
clearances, McKee BCT compression calculation, and palletization.
"""

import pytest
from app.optimization.engine import (
    OptimizationEngine,
    compute_carton_board_area_cm2,
    compute_mckee_compression,
    compute_palletization,
)
from app.schemas.schemas import AlternativeRank, BaselinePackaging, OptimizationConfig


def test_compute_carton_board_area():
    # 100 x 100 x 100 mm box -> 2 * (100*100*3) = 60,000 mm² = 600 cm²
    area = compute_carton_board_area_cm2(100.0, 100.0, 100.0)
    assert area == 600.0


def test_mckee_compression_formula():
    """Verify McKee Box Compression Test (BCT) matches equation."""
    # L=400, W=300, H=300, thickness=4mm, ECT=5.5 kN/m, weight=5kg
    # Perimeter U = 2 * (400 + 300) = 1400 mm
    # BCT (N) = 5.876 * 5.5 * sqrt(1400 * 4) = 32.318 * 74.833 = 2418.4 N
    mckee = compute_mckee_compression(
        outer_L=400.0,
        outer_W=300.0,
        outer_H=300.0,
        board_thickness_mm=4.0,
        ect_kn_m=5.5,
        box_gross_weight_kg=5.0,
        safety_factor=4.5,
    )
    assert mckee.bct_newtons > 2000.0
    assert mckee.bct_kgf > 200.0
    assert mckee.estimated_max_stack_layers >= 5


def test_palletization_calculation():
    """Verify Euro pallet 1200x800 packing calculation finds optimal orientation."""
    pallet = compute_palletization(
        outer_L=400.0,
        outer_W=300.0,
        outer_H=300.0,
        box_gross_weight_kg=5.0,
    )
    # Orientation 2: 1200/300 = 4, 800/400 = 2 -> 8 per layer (better than 3x2=6)
    assert pallet.cartons_per_layer == 8
    # 1800/300 = 6 layers
    assert pallet.layers_count == 6
    assert pallet.total_cartons_per_pallet == 48
    assert pallet.pallet_area_utilization_pct > 70.0


def test_optimization_generates_three_alternatives_with_savings():
    engine = OptimizationEngine()
    baseline = BaselinePackaging(
        carton_outer_length_mm=600.0,
        carton_outer_width_mm=500.0,
        carton_outer_height_mm=400.0,
        board_type="BC Double Wall",
        board_thickness_mm=5.0,
        carton_cost_per_unit=20.0,
        currency="EGP",
        units_per_pallet=16,
        pallet_type="Euro Pallet 1200x800",
    )

    result = engine.generate_alternatives(
        project_id="test-proj-1",
        product_name="Table Blender",
        product_dims_mm={"L": 300.0, "W": 200.0, "H": 150.0},
        product_weight_kg=2.5,
        fragility_class="MEDIUM",
        baseline=baseline,
    )

    assert len(result.alternatives) == 3
    recommended = [a for a in result.alternatives if a.rank == AlternativeRank.RECOMMENDED]
    assert len(recommended) == 1

    for alt in result.alternatives:
        assert alt.savings.savings_status == "CALCULATED"
        assert alt.savings.material_saved_pct is not None
        assert alt.cost.total_cost is not None
        assert alt.mckee_compression.bct_newtons > 0
        assert alt.palletization.total_cartons_per_pallet > 0

    alt_tight = next(a for a in result.alternatives if "Tight" in a.name)
    assert alt_tight.savings.material_saved_pct > 0
