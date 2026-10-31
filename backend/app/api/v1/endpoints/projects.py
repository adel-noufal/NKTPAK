"""
NxtPak AI — Projects API Endpoints
All business logic is delegated to services/agents; endpoints validate HTTP traffic.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
)
from app.services import project_service
from app.standards.registry import get_registry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Projects"])
orchestrator = Orchestrator()
exporter = Exporter()


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
    Create a project, run the deterministic optimization pipeline,
    evaluate against ISO standards registry, and return the complete result.
    """
    project_id = str(uuid.uuid4())
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

    # Persist
    saved_proj = project_service.create_project(db, project_in, pipeline_res)

    return {
        "project_id": saved_proj.id,
        "name": saved_proj.name,
        "description": saved_proj.description,
        "status": saved_proj.status,
        "created_at": saved_proj.created_at,
        "updated_at": saved_proj.updated_at,
        "pipeline_result": pipeline_res,
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
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "has_results": p.optimization_result is not None,
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
        "baseline_data": proj.baseline_data,
        "optimization_config": proj.optimization_config,
        "optimization_result": proj.optimization_result,
        "standards_result": proj.standards_result,
        "selected_alternative_id": proj.selected_alternative_id,
        "created_at": proj.created_at,
        "updated_at": proj.updated_at,
    }


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Delete a project."""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.post("/projects/{project_id}/export")
def export_project_endpoint(
    project_id: str,
    req: ReportRequest,
    db: Session = Depends(get_db),
):
    """
    Generate and download PDF, HTML, or JSON report for a project.
    """
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


@router.get("/examples")
def list_examples_endpoint():
    """List reference and sample product example projects."""
    return project_service.list_example_projects()


@router.post("/examples/{example_id}/load")
def load_example_endpoint(
    example_id: str,
    db: Session = Depends(get_db),
):
    """Load an example project, execute pipeline, and persist."""
    ex_data = project_service.get_example_project(example_id)
    if not ex_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Example not found")

    p_raw = ex_data.get("product", {})
    packed_dims = p_raw.get("packed_dimensions") or p_raw.get("packed_bounding_box", {})

    proj_in = ProjectCreate(
        name=ex_data.get("example_name", "Example Project"),
        description=ex_data.get("description"),
        product={
            "name": p_raw.get("name", "Product"),
            "category": p_raw.get("category", "General"),
            "packed_dimensions": {
                "length": packed_dims.get("length_mm", 100),
                "width": packed_dims.get("width_mm", 100),
                "height": packed_dims.get("height_mm", 100),
                "unit": packed_dims.get("unit", "mm"),
            },
            "weight_kg": p_raw.get("weight_kg", 1.0),
            "fragility_class": p_raw.get("fragility_class", "MEDIUM"),
            "fragility_note": p_raw.get("fragility_note"),
            "provenance": {
                "source_name": ex_data.get("provenance", {}).get("source_name", "Sample"),
                "source_url": ex_data.get("provenance", {}).get("source_url"),
                "retrieval_date": ex_data.get("provenance", {}).get("retrieval_date"),
                "data_label": ex_data.get("data_label", "SAMPLE_DATA"),
                "verified": ex_data.get("provenance", {}).get("verified", False),
            },
        },
        baseline=(
            {
                "carton_outer_length_mm": ex_data["baseline_packaging"]["carton"]["outer_length_mm"],
                "carton_outer_width_mm": ex_data["baseline_packaging"]["carton"]["outer_width_mm"],
                "carton_outer_height_mm": ex_data["baseline_packaging"]["carton"]["outer_height_mm"],
                "board_thickness_mm": ex_data["baseline_packaging"]["carton"]["board_thickness_mm"],
                "board_type": ex_data["baseline_packaging"]["carton"].get("board_type"),
                "carton_cost_per_unit": ex_data["baseline_packaging"].get("unit_costs", {}).get("carton_cost_per_unit"),
                "total_insert_cost_per_unit": ex_data["baseline_packaging"].get("unit_costs", {}).get("insert_cost_per_unit"),
                "currency": ex_data["baseline_packaging"].get("unit_costs", {}).get("currency"),
                "data_label": ex_data["baseline_packaging"].get("label", "SAMPLE_DATA"),
            }
            if "baseline_packaging" in ex_data
            else None
        ),
        optimization_config=OptimizationConfig(),
    )

    project_id = str(uuid.uuid4())
    pipeline_res = orchestrator.run_pipeline(
        project_id=project_id,
        product_input=proj_in.product,
        baseline=proj_in.baseline,
        config=proj_in.optimization_config,
    )

    saved_proj = project_service.create_project(db, proj_in, pipeline_res)

    return {
        "project_id": saved_proj.id,
        "name": saved_proj.name,
        "description": saved_proj.description,
        "status": saved_proj.status,
        "pipeline_result": pipeline_res,
    }


@router.get("/standards")
def list_standards_registry_endpoint():
    """Retrieve all standards in the active registry with metadata."""
    reg = get_registry()
    standards = reg.get_all_standards()
    return {
        "registry_version": reg._registry_version,
        "standards_count": len(standards),
        "evaluation_statement": "Evaluated against: NxtPak ISO registry v1 (see source list). No company-specific requirements loaded.",
        "standards": standards,
    }
