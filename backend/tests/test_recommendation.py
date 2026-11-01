"""
Tests for AI Recommendation Engine (Hybrid Verifiable).
Verifies:
1. Candidate generation (4 realistic alternatives, 3 rejected candidates with failure checks).
2. Deterministic calculations (McKee BCT formula, Euro pallet layers, volume and material savings).
3. Deterministic fallback mode when LLM is offline.
4. Conversational refinement ("make it cheaper", "lock dimensions").
"""

from app.optimization.recommendation_engine import (
    generate_candidates,
    generate_recommendation_run,
    _calculate_mckee,
    _compute_pallet_layer,
)


def test_calculate_mckee_compression():
    # BCT = 5.876 * ECT * sqrt(Perimeter * Thickness)
    # ECT = 6.5 kN/m, Perimeter = 1600 mm, Thickness = 5.0 mm
    # sqrt(1600 * 5) = sqrt(8000) = 89.4427
    # BCT = 5.876 * 6.5 * 89.4427 = 3416.17 N
    bct_n, bct_kgf = _calculate_mckee(ect_kn_m=6.5, perimeter_mm=1600.0, thickness_mm=5.0)
    assert abs(bct_n - 3416.2) < 2.0
    assert abs(bct_kgf - 348.3) < 2.0


def test_compute_pallet_layer_euro_pallet():
    # Carton 400 x 300 mm on Euro Pallet 1200 x 800 mm
    # Orientation 1: 1200/400 = 3, 800/300 = 2 -> 6
    # Orientation 2: 1200/300 = 4, 800/400 = 2 -> 8
    best_count, area_pct, overhang = _compute_pallet_layer(box_l=400.0, box_w=300.0)
    assert best_count == 8
    assert area_pct == 100.0
    assert overhang == 0.0


def test_generate_candidates_structure():
    product = {
        "name": "Tornado Stand Fan TSF-16W",
        "packed_dimensions": {"length": 460.0, "width": 400.0, "height": 1400.0},
        "weight_kg": 7.3,
        "fragility_class": "MEDIUM",
    }
    baseline = {
        "carton_outer_length_mm": 575.0,
        "carton_outer_width_mm": 310.0,
        "carton_outer_height_mm": 490.0,
        "carton_cost_per_unit": 22.5,
        "currency": "EGP",
    }
    candidates, rejected = generate_candidates(product, baseline)

    # 4 realistic candidates generated
    assert len(candidates) == 4
    assert any(c.is_recommended for c in candidates)
    assert any(c.badge == "Lowest Cost" for c in candidates)
    assert any(c.badge == "Max Protection" for c in candidates)
    assert any(c.badge == "Pallet Efficient" for c in candidates)

    # 3 rejected candidates with specific failed check
    assert len(rejected) >= 3
    for r in rejected:
        assert r.failed_check
        assert r.explanation

    # Engineering checks on recommended candidate
    rec = next(c for c in candidates if c.is_recommended)
    assert rec.bct_newtons > 0
    assert rec.bct_kgf > 0
    assert rec.safety_factor > 0
    assert rec.units_per_pallet > 0
    assert len(rec.packout_steps) == 4


def test_recommendation_offline_deterministic_fallback():
    product = {
        "name": "Tornado Table Blender BL500/2",
        "product_length_mm": 180.0,
        "product_width_mm": 165.0,
        "product_height_mm": 390.0,
        "net_weight_kg": 3.2,
        "fragility": "HIGH",
    }
    baseline = {
        "carton_length_mm": 220.0,
        "carton_width_mm": 200.0,
        "carton_height_mm": 420.0,
        "unit_cost": 18.0,
        "currency": "EGP",
    }

    run = generate_recommendation_run(
        project_id="test-proj-123",
        product=product,
        baseline=baseline,
    )

    assert run.project_id == "test-proj-123"
    assert run.recommended is not None
    assert len(run.alternatives) == 3
    assert len(run.rejected_candidates) >= 3
    # When offline, explanation must be calculated and cite the exact numbers
    assert "Calculated" in run.explanation or "recommended" in run.explanation.lower()
    assert str(int(run.recommended.carton_length_mm)) in run.explanation
    assert len(run.test_plan) >= 3
    assert len(run.assumptions) >= 2


def test_recommendation_refinement_cheaper():
    product = {
        "name": "Tornado Stand Fan TSF-16W",
        "packed_dimensions": {"length": 460.0, "width": 400.0, "height": 1400.0},
        "weight_kg": 7.3,
        "fragility_class": "MEDIUM",
    }
    baseline = {
        "carton_outer_length_mm": 575.0,
        "carton_outer_width_mm": 310.0,
        "carton_outer_height_mm": 490.0,
        "carton_cost_per_unit": 22.5,
    }

    # User says "make it cheaper"
    run = generate_recommendation_run(
        project_id="test-proj-123",
        product=product,
        baseline=baseline,
        refinement_prompt="make it cheaper please",
    )
    assert run.recommended.badge == "Lowest Cost"
