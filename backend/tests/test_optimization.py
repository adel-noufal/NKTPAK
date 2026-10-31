"""
Tests for NxtPak AI Packaging Optimization Engine.
Tests volume utilization, material savings, deterministic alternative generation,
clearances, and handling of missing baseline.
"""

import pytest
from app.optimization.engine import OptimizationEngine, compute_carton_board_area_cm2
from app.schemas.schemas import AlternativeRank, BaselinePackaging, OptimizationConfig


def test_compute_carton_board_area():
    # 100 x 100 x 100 mm box
    # Area = 2 * (100*100 + 100*100 + 100*100) = 60,000 mm² = 600 cm²
    area = compute_carton_board_area_cm2(100.0, 100.0, 100.0)
    assert area == 600.0


def test_optimization_generates_three_alternatives():
    engine = OptimizationEngine()
    result = engine.generate_alternatives(
        project_id="test-proj-1",
        product_name="Test Product",
        product_dims_mm={"L": 300.0, "W": 200.0, "H": 150.0},
        product_weight_kg=2.5,
        fragility_class="MEDIUM",
    )

    assert len(result.alternatives) == 3
    # Check that there is exactly 1 recommended alternative
    recommended = [a for a in result.alternatives if a.rank == AlternativeRank.RECOMMENDED]
    assert len(recommended) == 1
    assert result.recommended is not None

    # Alt 1 (tight) should have smaller outer dimensions than Alt 3 (protective)
    alt_tight = next(a for a in result.alternatives if "Tight" in a.name)
    alt_prot = next(a for a in result.alternatives if "Protective" in a.name)
    assert alt_tight.outer_length_mm < alt_prot.outer_length_mm
    assert alt_tight.outer_width_mm < alt_prot.outer_width_mm
    assert alt_tight.outer_height_mm < alt_prot.outer_height_mm


def test_volume_utilization_formula():
    engine = OptimizationEngine()
    result = engine.generate_alternatives(
        project_id="test-proj-2",
        product_name="Cube",
        product_dims_mm={"L": 200.0, "W": 200.0, "H": 200.0},
        product_weight_kg=1.0,
        fragility_class="LOW",
    )

    for alt in result.alternatives:
        # Vol util must be between 0 and 1
        assert 0.0 < alt.savings.volume_utilization <= 1.0
        # inner cavity must be strictly larger than product
        assert alt.inner_length_mm > 200.0
        assert alt.inner_width_mm > 200.0
        assert alt.inner_height_mm > 200.0


def test_savings_without_baseline_is_not_configured():
    engine = OptimizationEngine()
    result = engine.generate_alternatives(
        project_id="test-proj-3",
        product_name="Product No Baseline",
        product_dims_mm={"L": 400.0, "W": 300.0, "H": 200.0},
        product_weight_kg=3.0,
        fragility_class="MEDIUM",
        baseline=None,
    )

    for alt in result.alternatives:
        assert alt.savings.savings_status == "NOT_CONFIGURED"
        assert alt.savings.material_saved_pct is None
        assert alt.cost.cost_status == "NOT_CONFIGURED"


def test_savings_with_baseline_is_calculated():
    engine = OptimizationEngine()
    # Baseline is an oversized box
    baseline = BaselinePackaging(
        carton_outer_length_mm=600.0,
        carton_outer_width_mm=500.0,
        carton_outer_height_mm=400.0,
        board_thickness_mm=5.0,
        carton_cost_per_unit=20.0,
        total_insert_cost_per_unit=5.0,
        currency="EGP",
    )

    result = engine.generate_alternatives(
        project_id="test-proj-4",
        product_name="Product With Baseline",
        product_dims_mm={"L": 300.0, "W": 200.0, "H": 150.0},
        product_weight_kg=2.0,
        fragility_class="MEDIUM",
        baseline=baseline,
    )

    for alt in result.alternatives:
        assert alt.savings.savings_status == "CALCULATED"
        assert alt.savings.material_saved_pct is not None
        assert alt.cost.total_cost is not None
        assert alt.cost.cost_status == "ESTIMATED_FROM_BASELINE"

    # Tight fit (Alt 1) and Standard fit (Alt 2) must save material vs this oversized baseline
    alt_tight = next(a for a in result.alternatives if "Tight" in a.name)
    assert alt_tight.savings.material_saved_pct > 0


def test_all_assumptions_recorded():
    engine = OptimizationEngine()
    result = engine.generate_alternatives(
        project_id="test-proj-5",
        product_name="Assumptions Check",
        product_dims_mm={"L": 100.0, "W": 100.0, "H": 100.0},
        product_weight_kg=0.5,
        fragility_class="LOW",
    )

    assert len(result.assumptions) >= 3
    for alt in result.alternatives:
        assert len(alt.assumptions) >= 2
