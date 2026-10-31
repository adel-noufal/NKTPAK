"""
NxtPak AI — Projects API Endpoints (Revision v6)
Real data model with provenance, components, El Araby fetch, file upload, and AI assistant.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.agents.orchestrator import Orchestrator, WorkflowError
from app.core.database import get_db
from app.exports.exporter import Exporter
from app.schemas.schemas import (
    ErrorResponse,
    ExportResult,
    OptimizationConfig,
    ProjectCreate,
    ProjectResponse,
    ReportRequest,
    FetchProductRequest,
    AssistantRequest,
    AssistantResponse,
)
from app.services import project_service
from app.standards.registry import get_registry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Projects"])
orchestrator = Orchestrator()
exporter = Exporter()


# ─────────────────────────────────────────────
# Projects CRUD
# ─────────────────────────────────────────────

@router.post(
    "/projects",
    response_model=dict[str, Any],
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse}},
)
def create_project_endpoint(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
):
    """
    Create a project. Runs deterministic optimization pipeline only if product dimensions
    are available. Saves all provenance data. Returns structured result.
    """
    project_id = str(uuid.uuid4())

    # Only run optimization if we have enough data
    pipeline_res = None
    has_packed_dims = (
        project_in.product.packed_dimensions is not None
        or any(c.has_dimensions for c in project_in.components)
    )

    if has_packed_dims:
        try:
            pipeline_res = orchestrator.run_pipeline(
                project_id=project_id,
                product_input=project_in.product,
                baseline=project_in.baseline,
                config=project_in.optimization_config,
            )
        except WorkflowError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": exc.message, "details": exc.details},
            )
        except Exception as exc:
            logger.error("Unexpected error in pipeline: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Optimization pipeline encountered an error: {str(exc)}",
            )

    saved_proj = project_service.create_project(db, project_in, pipeline_res)

    return {
        "project_id": saved_proj.id,
        "name": saved_proj.name,
        "description": saved_proj.description,
        "status": saved_proj.status,
        "created_at": saved_proj.created_at,
        "updated_at": saved_proj.updated_at,
        "pipeline_result": pipeline_res,
        "optimization_skipped": not has_packed_dims,
        "optimization_skipped_reason": (
            "No product dimensions or component dimensions provided — add component measurements to run optimization."
            if not has_packed_dims else None
        ),
    }


@router.get("/projects", response_model=list[dict[str, Any]])
def list_projects_endpoint(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all saved projects."""
    projs = project_service.list_projects(db, limit=limit, offset=offset)
    return [
        {
            "project_id": p.id,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "product_name": p.product_data.get("name") if p.product_data else None,
            "product_model": p.product_data.get("model") if p.product_data else None,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "has_results": p.optimization_result is not None,
            "has_baseline": p.baseline_data is not None,
            "has_components": bool(p.components_data),
        }
        for p in projs
    ]


@router.get("/projects/{project_id}", response_model=dict[str, Any])
def get_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Get project details and computed results."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return {
        "project_id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "status": proj.status,
        "language": proj.language,
        "product_data": proj.product_data,
        "components_data": getattr(proj, "components_data", []) or [],
        "baseline_data": proj.baseline_data,
        "planned_data": getattr(proj, "planned_data", None),
        "optimization_config": proj.optimization_config,
        "optimization_result": proj.optimization_result,
        "standards_result": proj.standards_result,
        "chat_history": getattr(proj, "chat_history", []) or [],
        "selected_alternative_id": proj.selected_alternative_id,
        "created_at": proj.created_at,
        "updated_at": proj.updated_at,
    }


@router.patch("/projects/{project_id}", response_model=dict[str, Any])
def update_project_endpoint(
    project_id: str,
    update_data: dict[str, Any],
    db: Session = Depends(get_db),
):
    """Partial-update a project (components, baseline, planned packaging, etc.)."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    updated = project_service.update_project(db, project_id, update_data)
    return {"project_id": updated.id, "status": "updated"}


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Delete a project."""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


# ─────────────────────────────────────────────
# Project Export
# ─────────────────────────────────────────────

@router.post("/projects/{project_id}/export")
def export_project_endpoint(
    project_id: str,
    req: ReportRequest,
    db: Session = Depends(get_db),
):
    """Generate and download PDF, HTML, or JSON report for a project."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project_payload = {
        "project_id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "normalized_product": proj.product_data,
        "baseline_data": proj.baseline_data,
        "optimization_result": proj.optimization_result,
        "standards_result": proj.standards_result,
        "active_geometry_engine": orchestrator.geom_engine.engine_name,
    }

    try:
        export_res = exporter.export_report(project_payload, format_type=req.format)
    except Exception as exc:
        logger.error("Failed to export report: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report export failed: {str(exc)}",
        )

    media_types = {
        "pdf": "application/pdf",
        "html": "text/html",
        "json": "application/json",
    }

    return FileResponse(
        path=export_res.file_path,
        filename=export_res.file_name,
        media_type=media_types.get(req.format, "application/octet-stream"),
    )


# ─────────────────────────────────────────────
# Reference Examples (real El Araby data only)
# ─────────────────────────────────────────────

@router.get("/examples")
def list_examples_endpoint():
    """List reference product examples with real provenance."""
    return project_service.list_example_projects()


@router.post("/examples/{example_id}/load")
def load_example_endpoint(
    example_id: str,
    db: Session = Depends(get_db),
):
    """
    Load a reference example and create a draft project.
    Does NOT run optimization — user must add component dimensions first.
    """
    ex_data = project_service.get_example_project(example_id)
    if not ex_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Example not found")

    p_raw = ex_data.get("product", {})
    prov_raw = ex_data.get("provenance", {})
    baseline_raw = ex_data.get("baseline")

    # Build product — no fake dimensions; assembled envelope stored as notes only
    product = {
        "name": p_raw.get("name", ex_data.get("example_name", "Product")),
        "model": p_raw.get("model") or ex_data.get("model"),
        "brand": p_raw.get("brand") or ex_data.get("brand"),
        "category": p_raw.get("category"),
        "packed_dimensions": None,  # Not set until components are measured
        "weight_kg": p_raw.get("net_weight_kg"),
        "fragility_class": p_raw.get("fragility_class"),  # May be None — user must choose
        "notes": p_raw.get("notes"),
        "provenance": {
            "source_name": prov_raw.get("source_name", ""),
            "source_url": prov_raw.get("source_url"),
            "retrieval_date": prov_raw.get("retrieval_date"),
            "source_type": prov_raw.get("source_type", "USER_ENTERED"),
            "is_edited": False,
            "evidence_snippet": prov_raw.get("evidence_snippet"),
        },
    }

    # Build baseline from real data (carton dims only; board thickness may be None)
    baseline = None
    if baseline_raw:
        baseline = {
            "carton_outer_length_mm": baseline_raw.get("carton_outer_length_mm"),
            "carton_outer_width_mm": baseline_raw.get("carton_outer_width_mm"),
            "carton_outer_height_mm": baseline_raw.get("carton_outer_height_mm"),
            "board_thickness_mm": baseline_raw.get("board_thickness_mm"),  # May be None
            "board_type": baseline_raw.get("board_type"),
            "carton_cost_per_unit": baseline_raw.get("carton_cost_per_unit"),
            "currency": baseline_raw.get("currency"),
            "data_label": ex_data.get("data_label", "USER_ENTERED"),
            "provenance": baseline_raw.get("provenance"),
        }

    # Save draft project (no pipeline — dimensions not yet known)
    saved = project_service.create_draft_project(db, {
        "name": ex_data.get("example_name", "Example Project"),
        "description": ex_data.get("description"),
        "product": product,
        "components": [],
        "component_suggestions": ex_data.get("component_suggestions", []),
        "baseline": baseline,
        "planned": None,
        "optimization_config": ex_data.get("optimization_config", {}),
        "datasheet_notes": p_raw.get("datasheet_notes", []),
        "technical_specs": p_raw.get("technical_specs", {}),
    })

    return {
        "project_id": saved.id,
        "name": saved.name,
        "description": saved.description,
        "status": saved.status,
        "optimization_status": "AWAITING_COMPONENT_DIMENSIONS",
        "next_step": "Add the measured dimensions of each packed component to run optimization.",
        "component_suggestions": ex_data.get("component_suggestions", []),
    }


# ─────────────────────────────────────────────
# Fetch from El Araby (deterministic parser + optional LLM)
# ─────────────────────────────────────────────

@router.post("/fetch-product")
def fetch_product_endpoint(req: FetchProductRequest):
    """
    Attempt to fetch and parse product data from El Araby website or a PDF URL.
    Returns field-by-field results with evidence snippets. Never invents numbers.
    """
    from app.services.fetch_service import fetch_product_data
    result = fetch_product_data(
        model_number=req.model_number,
        product_url=req.product_url,
    )
    return result


# ─────────────────────────────────────────────
# Upload 3D/CAD File
# ─────────────────────────────────────────────

@router.post("/upload-model")
async def upload_model_endpoint(file: UploadFile = File(...)):
    """
    Upload a 3D or CAD file (STL, OBJ, GLB, STEP, DXF).
    Returns bounding box(es) and component list. DWG files get a clear error message.
    """
    from app.services.upload_service import parse_uploaded_file
    contents = await file.read()
    result = parse_uploaded_file(
        file_name=file.filename or "upload",
        file_bytes=contents,
    )
    return result


# ─────────────────────────────────────────────
# AI Assistant
# ─────────────────────────────────────────────

@router.post("/assistant", response_model=AssistantResponse)
def assistant_endpoint(req: AssistantRequest, db: Session = Depends(get_db)):
    """
    Page-aware AI assistant. Works with project context.
    Uses LLM if configured; falls back to rule-based offline analysis.
    """
    from app.services.assistant_service import get_assistant_reply

    # Optionally load project context if project_id provided
    project_data = None
    if req.project_id:
        proj = project_service.get_project(db, req.project_id)
        if proj:
            project_data = {
                "name": proj.name,
                "product": proj.product_data,
                "components": getattr(proj, "components_data", []) or [],
                "baseline": proj.baseline_data,
                "optimization_result": proj.optimization_result,
                "standards_result": proj.standards_result,
            }

    response = get_assistant_reply(
        message=req.message,
        page_context=req.page_context,
        project_data=project_data,
        history=req.history,
    )

    # Persist chat turn in project if applicable
    if req.project_id and project_data:
        project_service.append_chat_turn(
            db, req.project_id,
            user_msg=req.message,
            assistant_msg=response.reply,
        )

    return response


# ─────────────────────────────────────────────
# Re-run optimization for existing project
# ─────────────────────────────────────────────

@router.post("/projects/{project_id}/optimize")
def reoptimize_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Re-run optimization pipeline for a project with current data."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from app.schemas.schemas import ProductInput, OptimizationConfig, BaselinePackaging
    try:
        product_in = ProductInput(**proj.product_data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot parse stored product data: {exc}"
        )

    config = OptimizationConfig(**(proj.optimization_config or {}))
    baseline = BaselinePackaging(**proj.baseline_data) if proj.baseline_data else None

    try:
        pipeline_res = orchestrator.run_pipeline(
            project_id=proj.id,
            product_input=product_in,
            baseline=baseline,
            config=config,
        )
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": exc.message, "details": exc.details},
        )

    project_service.update_project(db, project_id, {
        "optimization_result": pipeline_res.get("optimization_result"),
        "standards_result": pipeline_res.get("standards_result"),
        "status": "completed",
    })

    return {"project_id": proj.id, "status": "re-optimized", "pipeline_result": pipeline_res}


# ─────────────────────────────────────────────
# Standards Registry
# ─────────────────────────────────────────────

@router.get("/standards")
def list_standards_registry_endpoint():
    """Retrieve all standards in the active registry with metadata."""
    reg = get_registry()
    standards = reg.get_all_standards()
    return {
        "registry_version": reg._registry_version,
        "standards_count": len(standards),
        "evaluation_statement": (
            "Evaluated against: NxtPak ISO registry v1 (see source list). "
            "No company-specific requirements loaded."
        ),
        "standards": standards,
    }
