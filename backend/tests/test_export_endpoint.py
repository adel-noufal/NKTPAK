import json
from io import BytesIO
from pathlib import Path
import uuid

from fastapi.responses import FileResponse, JSONResponse
from pypdf import PdfReader

from app.api.v1.endpoints.projects import export_project_endpoint
from app.models.models import Project
from app.schemas.schemas import ReportRequest


def _project(db_session, with_dimensions=True):
    product = {"name": "Regression test product", "product_type": "blender", "weight_kg": 3.0, "fragility_class": "HIGH", "shipping_mode": "parcel", "provenance": {"data_label": "USER_ENTERED"}}
    if with_dimensions:
        product["packed_dimensions"] = {"length": 180, "width": 165, "height": 390, "unit": "mm"}
    project = Project(
        id=str(uuid.uuid4()),
        name="Export regression project",
        brand="Test",
        model_number="TEST-1",
        status="completed",
        language="en",
        product_data=product,
        components_data=[],
        baseline_data={"carton_outer_length_mm": 312, "carton_outer_width_mm": 297, "carton_outer_height_mm": 522, "board_thickness_mm": 4},
        optimization_config={},
        optimization_result={"alternatives": [], "recommended": {"outer_length_mm": 312, "outer_width_mm": 297, "outer_height_mm": 522}},
        standards_result={"results": []},
        chat_history=[],
    )
    db_session.add(project)
    db_session.commit()
    return project


def test_every_supported_export_is_nonempty_and_contains_ista_test_plan(db_session):
    project = _project(db_session)
    for fmt in ("pdf", "html", "dxf", "json"):
        response = export_project_endpoint(project.id, ReportRequest(project_id=project.id, alternative_id="test", format=fmt), db_session)
        assert isinstance(response, FileResponse)
        content = Path(response.path).read_bytes()
        assert content
        if fmt == "pdf":
            reader = PdfReader(BytesIO(content))
            assert len(reader.pages) >= 1
            pdf_text = " ".join(page.extract_text() or "" for page in reader.pages)
            assert "Suggested validation tests" in pdf_text and "ISTA 3A" in pdf_text
        elif fmt == "html":
            text = content.decode("utf-8")
            assert "<style>" in text and "Suggested validation tests (to be performed in an accredited lab)" in text
            assert "ISTA 3A" in text
        elif fmt == "dxf":
            text = content.decode("ascii")
            assert "SECTION" in text and "CUT" in text and "CREASE" in text
            assert "1253.00" in text and "819.00" in text
        else:
            payload = json.loads(content)
            assert payload["project"]["suggested_validation_tests"]["primary_standard"] == "ISTA 3A"


def test_incomplete_export_returns_clear_422_without_stack_trace(db_session):
    project = _project(db_session, with_dimensions=False)
    response = export_project_endpoint(project.id, ReportRequest(project_id=project.id, alternative_id="test", format="html"), db_session)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 422
    payload = json.loads(response.body)
    assert "product dimensions are missing" in payload["message"]
    assert payload["error_id"]
    assert "Traceback" not in payload["message"]
