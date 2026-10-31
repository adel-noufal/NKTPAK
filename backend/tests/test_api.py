"""
API Endpoint tests.
Tests endpoint logic, schemas, database persistence, and pipeline integration directly.
Fast, 100% deterministic, and free of AnyIO/HTTP threading issues on Python 3.13.
"""

import pytest
from app.api.v1.endpoints.projects import (
    create_project_endpoint,
    get_project_endpoint,
    list_examples_endpoint,
    load_example_endpoint,
)
from app.core.database import SessionLocal, init_db
from app.main import health_check
from app.schemas.schemas import (
    DimensionsInput,
    OptimizationConfig,
    ProductInput,
    BaselinePackaging,
    ProjectCreate,
)
from app.standards.registry import get_registry

# Setup DB and standards
init_db()
get_registry().load()


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_health_endpoint():
    res = health_check()
    assert res["status"] == "healthy"
    assert "geometry_engine" in res
    assert res["standards_version"] == "v1"


def test_list_examples_endpoint():
    """
    v6: Only real El Araby products are included (TSF-16W and BL500/2).
    Fake examples (stand-fan-toshiba, stand-fan-generic, blender-4part) were removed.
    """
    examples = list_examples_endpoint()
    assert isinstance(examples, list)
    assert len(examples) >= 2
    ids = [e["example_id"] for e in examples]
    assert "tsf-16w" in ids
    assert "bl500-2" in ids


def test_create_project_endpoint(db_session):
    proj_in = ProjectCreate(
        name="Integration Test Stand Fan",
        description="API verification project",
        language="en",
        product=ProductInput(
            name="Stand Fan Test",
            category="Appliances",
            packed_dimensions=DimensionsInput(
                length=480,
                width=380,
                height=1200,
                unit="mm",
            ),
            weight_kg=5.5,
            fragility_class="MEDIUM",
        ),
        baseline=BaselinePackaging(
            carton_outer_length_mm=550,
            carton_outer_width_mm=450,
            carton_outer_height_mm=1280,
            board_thickness_mm=4.5,
            carton_cost_per_unit=15.0,
            total_insert_cost_per_unit=3.0,
            currency="EGP",
        ),
        optimization_config=OptimizationConfig(
            min_clearance_mm=15.0,
            standard_clearance_mm=25.0,
            generous_clearance_mm=40.0,
        ),
    )

    data = create_project_endpoint(proj_in, db=db_session)
    assert "project_id" in data
    assert "pipeline_result" in data

    pipeline_res = data["pipeline_result"]
    assert "optimization_result" in pipeline_res
    assert len(pipeline_res["optimization_result"]["alternatives"]) == 3
    assert "standards_result" in pipeline_res
    assert "geometry_data" in pipeline_res

    # Verify retrieval from DB
    retrieved = get_project_endpoint(data["project_id"], db=db_session)
    assert retrieved["name"] == "Integration Test Stand Fan"
    assert retrieved["optimization_result"] is not None


def test_load_example_endpoint(db_session):
    """
    v6: Loading an example creates a DRAFT project — no optimization runs because
    component dimensions are not yet known. The response has optimization_status
    and next_step instead of pipeline_result.
    """
    examples = list_examples_endpoint()
    assert len(examples) > 0
    first_ex_id = examples[0]["example_id"]

    data = load_example_endpoint(first_ex_id, db=db_session)
    assert "project_id" in data
    assert data["status"] == "draft"
    assert data["optimization_status"] == "AWAITING_COMPONENT_DIMENSIONS"
    assert "next_step" in data
    # pipeline_result is NOT present — dimensions not yet available
    assert "pipeline_result" not in data
