import pytest

from app.optimization.recommendation_engine import generate_candidates
from app.optimization.foam import (
    CushionCurve,
    CushionCurvePoint,
    CushionMaterial,
    FoamSupportInput,
    NO_CURVE_WARNING,
    calculate_foam_design,
    empty_material_library,
)
from app.services.project_service import get_foam_materials, update_foam_materials
from app.models.models import Project
from app.api.v1.endpoints.projects import get_project_recommendation_endpoint


def test_curve_interpolation_selects_thinnest_passing_curve():
    material = CushionMaterial(
        material_id="supplier-epe",
        name="Supplier EPE",
        material_type="foam",
        source_name="Controlled curve fixture",
        source_url="https://test.invalid/foam-curve",
        retrieval_date="2026-11-01",
        cushion_curves=[
            CushionCurve(
                thickness_mm=20,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=55),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=35),
                ],
            ),
            CushionCurve(
                thickness_mm=30,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=40),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=20),
                ],
            ),
        ],
    )
    # 2 kg / 0.001 m² = 19.6133 kPa; interpolated peak-G values are 45.3867 and 30.3867.
    result = calculate_foam_design(
        material=material,
        supports=[FoamSupportInput(name="base", carried_weight_kg=2, bearing_area_mm2=1000)],
        drop_height_mm=500,
        fragility_limit_g=80,
        safety_factor=2,
    )
    assert result.supports[0].static_stress_kpa == pytest.approx(19.6133, abs=0.001)
    assert result.selected_thickness_mm == 30
    assert result.estimated_peak_deceleration_g == pytest.approx(30.3867, abs=0.001)
    assert result.protection_margin_g == pytest.approx(19.2266, abs=0.001)


def test_requested_thickness_that_fails_offers_nearest_curve_valid_thickness():
    material = CushionMaterial(
        material_id="supplier-epe",
        name="Supplier EPE",
        material_type="foam",
        source_name="Controlled curve fixture",
        source_url="https://test.invalid/foam-curve",
        retrieval_date="2026-11-01",
        cushion_curves=[
            CushionCurve(
                thickness_mm=20,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=55),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=35),
                ],
            ),
            CushionCurve(
                thickness_mm=30,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=40),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=20),
                ],
            ),
        ],
    )
    result = calculate_foam_design(
        material=material,
        supports=[FoamSupportInput(name="base", carried_weight_kg=2, bearing_area_mm2=1000)],
        drop_height_mm=500,
        fragility_limit_g=80,
        safety_factor=2,
        requested_max_thickness_mm=20,
    )
    assert result.selected_thickness_mm == 30
    assert any("Requested 20 mm" in warning and "nearest valid thickness is 30 mm" in warning for warning in result.warnings)


def test_missing_curve_is_not_given_invented_deceleration_or_thickness():
    result = calculate_foam_design(
        material=None,
        supports=[FoamSupportInput(name="base", carried_weight_kg=1.5, bearing_area_mm2=5000)],
        drop_height_mm=400,
        fragility_limit_g=60,
        safety_factor=1.5,
    )
    assert result.status == "NO_CURVE"
    assert result.selected_thickness_mm is None
    assert result.estimated_peak_deceleration_g is None
    assert result.warnings == [NO_CURVE_WARNING]


def test_default_material_catalog_leaves_unverified_properties_missing():
    materials = empty_material_library()
    assert len(materials) == 10
    assert all(not material.enabled for material in materials)
    assert all(material.density_kg_m3 is None for material in materials)
    assert all(not material.cushion_curves for material in materials)
    assert all(material.source_url is None for material in materials)


def test_material_library_persists_supplier_curve_data(db_session):
    material = CushionMaterial(
        material_id="supplier-epe",
        name="Supplier EPE",
        material_type="foam",
        source_name="Supplier technical sheet",
        source_url="https://supplier.invalid/technical-sheet",
        retrieval_date="2026-11-01",
        enabled=True,
        cushion_curves=[
            CushionCurve(
                thickness_mm=25,
                drop_height_mm=400,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=45),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=25),
                ],
            ),
        ],
    )
    saved = update_foam_materials(db_session, [material])
    assert get_foam_materials(db_session)[0] == saved[0]
    assert saved[0].cushion_curves[0].points[0].peak_deceleration_g == 45


def test_recommendation_carton_inner_size_uses_selected_curve_thickness():
    curve_material = CushionMaterial(
        material_id="supplier-epe",
        name="Supplier EPE",
        material_type="foam",
        source_name="Controlled curve fixture",
        source_url="https://test.invalid/foam-curve",
        retrieval_date="2026-11-01",
        cushion_curves=[
            CushionCurve(
                thickness_mm=20,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=55),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=35),
                ],
            ),
            CushionCurve(
                thickness_mm=30,
                drop_height_mm=500,
                points=[
                    CushionCurvePoint(static_stress_kpa=10, peak_deceleration_g=40),
                    CushionCurvePoint(static_stress_kpa=30, peak_deceleration_g=20),
                ],
            ),
        ],
    )
    candidates, _ = generate_candidates(
        product={
            "packed_dimensions": {"length": 100, "width": 80, "height": 60},
            "weight_kg": 2,
            "fragility_class": "MEDIUM",
            "foam_design_input": {
                "material": curve_material.model_dump(mode="json"),
                "supports": [{"name": "base", "carried_weight_kg": 2, "bearing_area_mm2": 1000}],
                "drop_height_mm": 500,
                "fragility_limit_g": 80,
                "safety_factor": 2,
            },
        },
        baseline={
            "carton_outer_length_mm": 200,
            "carton_outer_width_mm": 180,
            "carton_outer_height_mm": 160,
        },
    )
    candidate = candidates[0]
    assert candidate.cushion_thickness_mm == 30
    assert candidate.foam_design.selected_thickness_mm == 30
    assert candidate.foam_design.foam_volume_mm3 == 1_992_000
    assert candidate.carton_length_mm - 2 * candidate.board_thickness_mm == 160
    assert candidate.carton_width_mm - 2 * candidate.board_thickness_mm == 140
    assert candidate.carton_height_mm - 2 * candidate.board_thickness_mm == 120


def test_missing_product_measurements_block_recommendation_instead_of_using_defaults():
    with pytest.raises(ValueError, match="Product length"):
        generate_candidates(
            product={"weight_kg": 2, "fragility_class": "MEDIUM"},
            baseline={
                "carton_outer_length_mm": 200,
                "carton_outer_width_mm": 180,
                "carton_outer_height_mm": 160,
            },
        )


def test_missing_baseline_cost_is_not_fabricated():
    candidates, _ = generate_candidates(
        product={
            "packed_dimensions": {"length": 100, "width": 80, "height": 60},
            "weight_kg": 2,
            "fragility_class": "MEDIUM",
        },
        baseline={
            "carton_outer_length_mm": 200,
            "carton_outer_width_mm": 180,
            "carton_outer_height_mm": 160,
        },
    )
    assert all(candidate.cost_per_unit is None for candidate in candidates)
    assert all(candidate.cost_savings_pct is None for candidate in candidates)


def test_recommendation_read_returns_calculated_result_without_waiting_for_ai(db_session):
    project = Project(
        name="Measured project",
        brand="User-entered",
        model_number="Measured-1",
        product_data={
            "name": "Measured product",
            "packed_dimensions": {"length": 100, "width": 80, "height": 60},
            "weight_kg": 2,
            "fragility_class": "MEDIUM",
            "components": [],
        },
        baseline_data={
            "carton_outer_length_mm": 200,
            "carton_outer_width_mm": 180,
            "carton_outer_height_mm": 160,
        },
        optimization_result={},
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    run = get_project_recommendation_endpoint(project.id, db_session)
    assert run.is_ai_reasoned is False
    assert run.model_name == "Deterministic Calculation Engine"
    assert run.recommended.foam_design.status == "NO_CURVE"
    assert run.recommended.carton_length_mm > 0
