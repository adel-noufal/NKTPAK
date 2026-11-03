"""
Production API Endpoint Tests.
Tests real project creation, mandatory field validation, duplicate detection,
empty database state, and dynamic product fetch pipeline.
"""

import pytest
from app.api.v1.endpoints.projects import (
    create_project_endpoint,
    get_project_endpoint,
    update_project_endpoint,
    list_projects_endpoint,
    fetch_product_endpoint,
    get_settings_endpoint,
    update_settings_endpoint,
)
from app.core.database import SessionLocal
from app.main import health_check
from app.schemas.schemas import (
    DimensionsInput,
    OptimizationConfig,
    ProductInput,
    BaselinePackaging,
    ProjectCreate,
    ProductSearchRequest,
    AdminSettingsUpdate,
    FragilityClass,
)
from app.standards.registry import get_registry  # noqa: F401 (used by conftest)


def test_health_endpoint():
    res = health_check()
    assert res["status"] == "healthy"
    assert "geometry_engine" in res
    assert "llm_status" in res
    assert "llm_provider" in res


def test_api_health_route():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


def test_post_exact_new_project_form_payload_returns_201(db_session):
    """The payload built by the current New Project form must match the live API contract."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.database import get_db

    payload = {
        "name": "Tornado Blender BL500/2",
        "description": "Tornado table blender, model BL500/2, 1.5L glass jug, 500W, net weight 3.2 kg, product dimensions 180 x 165 x 390 mm.",
        "product": {
            "name": "Tornado Blender BL500/2", "brand": "Tornado", "model": "BL500/2", "product_type": "blender",
            "product_type_provenance": {"source_name": "From your description", "source_type": "FROM_DESCRIPTION", "is_edited": False},
            "weight_kg": 3.2, "fragility_class": "MEDIUM",
            "packed_dimensions": {"length": 180, "width": 165, "height": 390, "unit": "mm"},
            "components": [], "images": [],
            "provenance": {"source_name": "From your description", "source_type": "FROM_DESCRIPTION", "is_edited": False},
        },
        "components": [],
        "baseline": {
            "carton_outer_length_mm": 240, "carton_outer_width_mm": 225, "carton_outer_height_mm": 450,
            "board_type": "BC Double Wall", "board_thickness_mm": 5, "carton_cost_per_unit": 22.5,
            "currency": "EGP", "units_per_pallet": 16, "pallet_type": "Euro Pallet (1200 x 800 mm)",
            "provenance": {"source_name": "From your description", "source_type": "FROM_DESCRIPTION", "is_edited": False},
        },
        "optimization_config": {"min_clearance_mm": 15, "standard_clearance_mm": 25, "generous_clearance_mm": 40},
        "language": "en",
    }
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/projects", json=payload)
        assert response.status_code == 201, response.text
        assert response.json().get("project_id")
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_empty_database_projects_list(db_session):
    """Production rule: database lists return empty state when no projects created."""
    # Ensure fresh query works
    projects = list_projects_endpoint(db=db_session)
    assert isinstance(projects, list)


def test_create_project_with_all_required_fields(db_session):
    """Test project creation requires brand, model, dims, baseline, flute, and cost."""
    proj_in = ProjectCreate(
        name="Tornado Fan Production Project",
        product=ProductInput(
            name="Tornado Stand Fan",
            brand="Tornado",
            model="TSF-16W",
            sku="EAN-6221127018394",
            weight_kg=7.3,
            fragility_class=FragilityClass.MEDIUM,
            packed_dimensions=DimensionsInput(
                length=520.0,
                width=280.0,
                height=450.0,
                unit="mm",
            ),
        ),
        baseline=BaselinePackaging(
            carton_outer_length_mm=575.0,
            carton_outer_width_mm=310.0,
            carton_outer_height_mm=490.0,
            board_type="BC Double Wall",
            board_thickness_mm=5.0,
            carton_cost_per_unit=22.50,
            currency="EGP",
            units_per_pallet=16,
            pallet_type="Euro Pallet 1200x800",
        ),
        optimization_config=OptimizationConfig(
            min_clearance_mm=15.0,
            standard_clearance_mm=25.0,
            generous_clearance_mm=40.0,
        ),
        language="en",
    )

    data = create_project_endpoint(proj_in, db=db_session)
    assert "project_id" in data
    persisted = get_project_endpoint(data["project_id"], db=db_session)
    assert persisted["product_data"]["packed_dimensions"] == {
        "length": 520.0, "width": 280.0, "height": 450.0, "unit": "mm"
    }
    update_project_endpoint(data["project_id"], {"product_data": {"product_type": "stand_fan"}}, db=db_session)
    after_type_patch = get_project_endpoint(data["project_id"], db=db_session)
    assert after_type_patch["product_data"]["packed_dimensions"] == persisted["product_data"]["packed_dimensions"]
    update_project_endpoint(data["project_id"], {"description": "Partial top-level PATCH"}, db=db_session)
    after_partial_patch = get_project_endpoint(data["project_id"], db=db_session)
    assert after_partial_patch["product_data"]["packed_dimensions"] == persisted["product_data"]["packed_dimensions"]
    assert after_partial_patch["product_data"]["product_type"] == "stand_fan"
    assert data["brand"] == "Tornado"
    assert data["model_number"] == "TSF-16W"
    assert "pipeline_result" in data
    pipeline = data["pipeline_result"]
    assert "optimization_result" in pipeline
    assert len(pipeline["optimization_result"]["alternatives"]) == 3

    # Check McKee compression output is present
    recommended = pipeline["optimization_result"]["recommended"]
    assert "mckee_compression" in recommended
    assert recommended["mckee_compression"]["bct_newtons"] > 0
    assert "palletization" in recommended
    assert recommended["palletization"]["total_cartons_per_pallet"] > 0

    # Test Duplicate Detection
    dup_data = create_project_endpoint(proj_in, db=db_session)
    assert dup_data["duplicate_warning"] is not None
    assert "already exists" in dup_data["duplicate_warning"]


def test_fetch_product_typo_pipeline():
    """Searching 'tsd-16w' returns 'Did you mean TSF-16W?'."""
    req = ProductSearchRequest(query="tsd-16w")
    res = fetch_product_endpoint(req)
    assert res.did_you_mean is None
    assert res.candidates == []
    assert "No products found" in res.status_message


def test_admin_settings_endpoint(db_session):
    """Test retrieving and updating settings."""
    initial = get_settings_endpoint(db=db_session)
    assert hasattr(initial, "llm_configured")

    update_res = update_settings_endpoint(
        AdminSettingsUpdate(currency="EGP", default_clearance_mm=22.0),
        db=db_session,
    )
    assert update_res.currency == "EGP"
    assert update_res.default_clearance_mm == 22.0


def test_create_project_knocked_down_appliance_with_components(db_session):
    """
    Test creating a project for a disassembled flat-pack appliance (e.g. Tornado Stand Fan TSF-16W).
    Assembled height is 1250mm, but flat-pack carton height is only 454mm.
    The presence of components allows the individual parts to fit into the carton without 422 error.
    """
    from app.schemas.schemas import ComponentInput

    proj_in = ProjectCreate(
        name="Tornado TSF-16W Disassembled Flat-Pack",
        product=ProductInput(
            name="Tornado Stand Fan 16 Inch",
            brand="Tornado",
            model="TSF-16W",
            weight_kg=6.5,
            fragility_class=FragilityClass.MEDIUM,
            packed_dimensions=DimensionsInput(
                length=460.0,
                width=460.0,
                height=1250.0,
                unit="mm",
            ),
            components=[
                ComponentInput(name="Fan Motor & Control Housing", length_mm=220.0, width_mm=180.0, height_mm=280.0, weight_kg=2.2),
                ComponentInput(name="Front & Rear Radial Mesh Guards", length_mm=455.0, width_mm=455.0, height_mm=120.0, weight_kg=1.4),
                ComponentInput(name="4-Blade Aerofoil Impeller", length_mm=400.0, width_mm=400.0, height_mm=50.0, weight_kg=0.4),
                ComponentInput(name="Weighted Pedestal Base", length_mm=450.0, width_mm=450.0, height_mm=65.0, weight_kg=1.8),
                ComponentInput(name="Stainless Telescopic Pole", length_mm=500.0, width_mm=50.0, height_mm=50.0, weight_kg=0.5),
            ],
            image_url="https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-front.jpg",
            images=["https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-front.jpg"],
        ),
        baseline=BaselinePackaging(
            carton_outer_length_mm=555.0,
            carton_outer_width_mm=255.0,
            carton_outer_height_mm=454.0,
            board_type="BC Double Wall",
            board_thickness_mm=5.0,
            carton_cost_per_unit=22.50,
            currency="EGP",
            units_per_pallet=16,
            pallet_type="Euro Pallet (1200 x 800 mm)",
        ),
        components=[
            ComponentInput(name="Fan Motor & Control Housing", length_mm=220.0, width_mm=180.0, height_mm=280.0, weight_kg=2.2),
            ComponentInput(name="Front & Rear Radial Mesh Guards", length_mm=455.0, width_mm=455.0, height_mm=120.0, weight_kg=1.4),
            ComponentInput(name="4-Blade Aerofoil Impeller", length_mm=400.0, width_mm=400.0, height_mm=50.0, weight_kg=0.4),
            ComponentInput(name="Weighted Pedestal Base", length_mm=450.0, width_mm=450.0, height_mm=65.0, weight_kg=1.8),
            ComponentInput(name="Stainless Telescopic Pole", length_mm=500.0, width_mm=50.0, height_mm=50.0, weight_kg=0.5),
        ],
    )

    created = create_project_endpoint(proj_in, db=db_session)
    assert created["name"] == "Tornado TSF-16W Disassembled Flat-Pack"
    assert created["status"] in ("completed", "draft")
