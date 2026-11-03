"""
NxtPak AI — Projects & Services API Endpoints (Production).
Strict validation, duplicate detection, live product search, CAD upload,
McKee compression, dieline export, and admin settings.
"""

from __future__ import annotations

import logging
import uuid
import urllib.request
import urllib.parse
from typing import Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field, field_validator
from pydantic import ValidationError
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
    ProductSearchRequest,
    ProductSearchResponse,
    CandidateSpecsResponse,
    AssistantRequest,
    AssistantResponse,
    AdminSettingsUpdate,
    AdminSettingsResponse,
)
from app.services import project_service
from app.models.models import AppNotification, StandardsCatalogEntry
from app.services.fetch_service import (
    search_product_pipeline,
    get_candidate_specs_by_id,
    estimate_dimensions_with_ai,
    is_ssrf_safe_url,
    EL_ARABY_BRANDS,
)
from app.services.upload_service import parse_uploaded_file
from app.services.assistant_service import get_assistant_reply, list_available_models, test_llm_connection
from app.standards.registry import get_registry
from app.schemas.description_schemas import DescriptionExtractRequest, ProjectDraft, ExtractedField
from app.schemas.recommendation_schemas import RecommendationRun, RefinementRequest, RecommendationFeedback
from app.optimization.recommendation_engine import generate_recommendation_run
from app.optimization.foam import CushionMaterial
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Projects"])
orchestrator = Orchestrator()
exporter = Exporter()


def _recommendation_product(db: Session, proj: Any) -> dict[str, Any]:
    product = dict(proj.product_data or {})
    product["foam_material_options"] = [
        material.model_dump(mode="json")
        for material in project_service.get_foam_materials(db)
        if material.enabled
    ]
    return product


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
    Create a project with full validation.
    Runs optimization pipeline against baseline and returns calculated results.
    """
    project_id = str(uuid.uuid4())

    # Check if duplicate product exists
    existing = project_service.check_existing_product(
        db,
        brand=project_in.product.brand,
        model_number=project_in.product.model or "",
        sku=project_in.product.sku,
    )
    duplicate_warning = None
    if existing:
        duplicate_warning = (
            f"A packaging project for '{existing.brand} {existing.model_number}' "
            f"already exists (Project ID: {existing.id[:8]}..., created {existing.created_at.strftime('%Y-%m-%d')}). "
            "You can continue to create this new variant or open the existing project."
        )

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
        logger.error("Pipeline failure: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization engine error: {str(exc)}",
        )

    saved_proj = project_service.create_project(db, project_in, pipeline_res)

    return {
        "project_id": saved_proj.id,
        "name": saved_proj.name,
        "brand": saved_proj.brand,
        "model_number": saved_proj.model_number,
        "sku": saved_proj.sku,
        "description": saved_proj.description,
        "status": saved_proj.status,
        "created_at": saved_proj.created_at,
        "updated_at": saved_proj.updated_at,
        "pipeline_result": pipeline_res,
        "duplicate_warning": duplicate_warning,
    }


@router.get("/projects", response_model=list[dict[str, Any]])
def list_projects_endpoint(
    search: Optional[str] = Query(None, description="Search by name, brand, model, SKU"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List saved projects with global search and filtering."""
    search_str = search if isinstance(search, str) else None
    brand_str = brand if isinstance(brand, str) else None
    status_str = status_filter if isinstance(status_filter, str) else None
    limit_int = limit if isinstance(limit, int) else 50
    offset_int = offset if isinstance(offset, int) else 0

    projs = project_service.list_projects(
        db, search=search_str, brand=brand_str, status=status_str, limit=limit_int, offset=offset_int
    )
    return [
        {
            "project_id": p.id,
            "short_id": p.id[:8],
            "name": p.name,
            "brand": p.brand or (p.product_data.get("brand") if p.product_data else "Unknown"),
            "model_number": p.model_number or (p.product_data.get("model") if p.product_data else ""),
            "sku": p.sku or (p.product_data.get("sku") if p.product_data else None),
            "description": p.description,
            "status": p.status,
            "product_name": p.product_data.get("name") if p.product_data else None,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "has_results": p.optimization_result is not None,
            "has_baseline": p.baseline_data is not None,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    return {
        "project_id": proj.id,
        "short_id": proj.id[:8],
        "name": proj.name,
        "brand": proj.brand,
        "model_number": proj.model_number,
        "sku": proj.sku,
        "description": proj.description,
        "status": proj.status,
        "language": proj.language,
        "product_data": proj.product_data,
        "components_data": (proj.product_data or {}).get("components", []),
        "baseline_data": proj.baseline_data,
        "planned_data": proj.planned_data,
        "optimization_config": proj.optimization_config,
        "optimization_result": proj.optimization_result,
        "standards_result": proj.standards_result,
        "chat_history": proj.chat_history or [],
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
    """Partial update of project."""
    try:
        updated = project_service.update_project(db, project_id, update_data)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    if "product_data" in update_data and updated.optimization_result:
        updated_result = dict(updated.optimization_result)
        updated_result.pop("ai_recommendation", None)
        updated.optimization_result = updated_result
        db.commit()
    return {"project_id": updated.id, "status": "updated"}


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Delete a project."""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")


@router.post("/projects/{project_id}/optimize")
def reoptimize_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Re-run optimization pipeline for an existing project."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    from app.schemas.schemas import ProductInput, OptimizationConfig, BaselinePackaging
    try:
        product_in = ProductInput(**proj.product_data)
        baseline = BaselinePackaging(**proj.baseline_data)
        config = OptimizationConfig(**(proj.optimization_config or {}))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Incomplete data for re-optimization: {exc}",
        )

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
# Dynamic Product Search / Fetch & Catalog Index
# ─────────────────────────────────────────────

@router.post("/fetch-product", response_model=ProductSearchResponse)
def fetch_product_endpoint(req: ProductSearchRequest):
    """
    Real dynamic product lookup pipeline:
    Searches web/brand sites, normalizes queries, detects typos ('Did you mean?'),
    and returns multiple candidates for side-by-side selection.
    """
    return search_product_pipeline(req)


@router.get("/search/autocomplete")
def search_autocomplete_endpoint(
    q: str = Query("", description="Query for suggestions"),
    limit: int = Query(8, ge=1, le=20)
):
    """Provide real-time autocomplete suggestions for models, categories, and brands."""
    from app.services.catalog_index import autocomplete_search
    return autocomplete_search(q, limit=limit)


@router.get("/catalog/browse")
def catalog_browse_endpoint(
    category: Optional[str] = Query(None, description="Category filter"),
    brand: Optional[str] = Query(None, description="Brand filter"),
):
    """Browse catalog mode: returns category breakdown and items with complete specs."""
    from app.services.catalog_index import browse_catalog
    return browse_catalog(category=category, brand=brand)


class SearchProviderTestRequest(BaseModel):
    provider: str = "serper"
    api_key: str = ""


@router.post("/test-search-provider")
def test_search_provider_endpoint(req: SearchProviderTestRequest):
    """Test connection and latency for external search providers (Serper, Tavily, Brave, Google)."""
    from app.services.search_provider import get_search_provider
    prov = get_search_provider(req.provider)
    if not prov:
        raise HTTPException(status_code=400, detail=f"Unsupported search provider '{req.provider}'.")
    return prov.test_connection(req.api_key)


@router.get("/brands", response_model=list[str])
def list_brands_endpoint():
    """List available brands for the dropdown."""
    return EL_ARABY_BRANDS


@router.get("/fetch-product/{candidate_id}/specs", response_model=CandidateSpecsResponse)
@router.post("/fetch-product/{candidate_id}/specs", response_model=CandidateSpecsResponse)
def get_product_specs_endpoint(candidate_id: str, model: Optional[str] = Query(None)):
    """Return multi-source cross-checked specifications, component breakdown and evidence."""
    return get_candidate_specs_by_id(candidate_id, model)


@router.post("/estimate-dimensions", response_model=dict[str, Any])
def estimate_dimensions_endpoint(body: dict[str, Any]):
    """Explicit user-requested AI estimate for unlisted product dimensions."""
    query = body.get("query", "")
    category = body.get("category")
    return estimate_dimensions_with_ai(query, category)


# ─────────────────────────────────────────────
# Upload 3D/CAD / PDF File
# ─────────────────────────────────────────────

@router.post("/upload-model", response_model=Any)
async def upload_model_endpoint(file: UploadFile = File(...)):
    """
    Upload real CAD file (STL, OBJ, 3MF, STEP, DXF, PDF).
    Extracts real bounding dimensions, volume, surface area, and mesh health.
    """
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
    Page-aware AI assistant with tool calling.
    Returns clear 'AI not configured' state if no key is set.
    """
    response = get_assistant_reply(
        message=req.message,
        project_id=req.project_id,
        page_context=req.page_context,
        history=req.history,
    )

    if req.project_id and response.mode == "ai":
        project_service.append_chat_turn(
            db, req.project_id, user_msg=req.message, assistant_msg=response.reply
        )

    return response


# ─────────────────────────────────────────────
# Admin Settings
# ─────────────────────────────────────────────

@router.get("/settings", response_model=AdminSettingsResponse)
def get_settings_endpoint(db: Session = Depends(get_db)):
    """Retrieve system settings."""
    return project_service.get_admin_settings(db)


@router.patch("/settings", response_model=AdminSettingsResponse)
def update_settings_endpoint(settings_in: AdminSettingsUpdate, db: Session = Depends(get_db)):
    """Update system settings (API keys, clearances, currency)."""
    return project_service.update_admin_settings(db, settings_in)


@router.get("/settings/foam-materials", response_model=list[CushionMaterial])
def get_foam_materials_endpoint(db: Session = Depends(get_db)):
    """Return the editable supplier cushioning library, without fabricated material data."""
    return project_service.get_foam_materials(db)


@router.put("/settings/foam-materials", response_model=list[CushionMaterial])
def update_foam_materials_endpoint(materials: list[CushionMaterial], db: Session = Depends(get_db)):
    """Persist material properties and sourced cushioning curves."""
    try:
        return project_service.update_foam_materials(db, materials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


# ─────────────────────────────────────────────
# Report & Dieline Export
# ─────────────────────────────────────────────

@router.post("/projects/{project_id}/export")
def export_project_endpoint(
    project_id: str,
    req: ReportRequest,
    db: Session = Depends(get_db),
):
    """Generate and download PDF, HTML, JSON, or DXF dieline."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    packed_dimensions = (proj.product_data or {}).get("packed_dimensions")
    if not isinstance(packed_dimensions, dict) or not all(
        isinstance(packed_dimensions.get(axis), (int, float)) and packed_dimensions[axis] > 0
        for axis in ("length", "width", "height")
    ):
        error_id = str(uuid.uuid4())
        message = "The report can't be created because the product dimensions are missing. Enter them and try again."
        logger.warning("Export rejected for incomplete product dimensions: error_id=%s project_id=%s", error_id, project_id)
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"message": message, "error_id": error_id})

    normalized_product = dict(proj.product_data or {})
    normalized_product.setdefault("provenance", {})
    if not normalized_product.get("dims_mm"):
        packed = normalized_product.get("packed_dimensions") or {}
        normalized_product["dims_mm"] = {
            "L": packed.get("length"),
            "W": packed.get("width"),
            "H": packed.get("height"),
        }
    dims = normalized_product.get("dims_mm") or {}
    if normalized_product.get("volume_mm3") is None and all(
        isinstance(dims.get(axis), (int, float)) for axis in ("L", "W", "H")
    ):
        normalized_product["volume_mm3"] = dims["L"] * dims["W"] * dims["H"]
    catalog_info = list_standards_registry_endpoint(db)
    from app.standards.registry import generate_test_plan
    suggested_tests = generate_test_plan(
        product_weight_kg=normalized_product.get("weight_kg"),
        distribution_channel=normalized_product.get("shipping_mode"),
        fragility=normalized_product.get("fragility_class", "MEDIUM"),
    )
    project_payload = {
        "project_id": proj.id,
        "name": proj.name,
        "brand": proj.brand,
        "model_number": proj.model_number,
        "description": proj.description,
        "normalized_product": normalized_product,
        "baseline_data": proj.baseline_data,
        "optimization_result": proj.optimization_result,
        "standards_result": proj.standards_result,
        "active_geometry_engine": orchestrator.geom_engine.engine_name,
        "evaluation_statement": catalog_info["evaluation_statement"],
        "standards_catalog": catalog_info["standards"],
        "suggested_validation_tests": suggested_tests,
    }

    try:
        export_res = exporter.export_report(project_payload, format_type=req.format)
    except Exception as exc:
        error_id = str(uuid.uuid4())
        logger.exception("Export failed: error_id=%s project_id=%s format=%s", error_id, project_id, req.format)
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": "The report could not be generated due to an internal export error.", "error_id": error_id})

    media_types = {
        "pdf": "application/pdf",
        "html": "text/html",
        "json": "application/json",
        "dxf": "application/dxf",
    }

    return FileResponse(
        path=export_res.file_path,
        filename=export_res.file_name,
        media_type=media_types.get(req.format, "application/octet-stream"),
    )


# ─────────────────────────────────────────────
# LLM Model List & Connection Test
# ─────────────────────────────────────────────

@router.get("/llm-models")
def list_llm_models_endpoint(
    provider: str = Query("gemini"),
    key: str = Query(""),
):
    """
    Return the list of text-generation models for the given provider.
    For Gemini: fetches live from the Generative Language API.
    For Anthropic/OpenAI: returns a curated static list.
    The API key is accepted as a query param ONLY for this discovery call;
    it is never logged or returned to the client.
    """
    # Retrieve saved key from DB when the caller doesn't supply one
    if not key:
        from app.services.assistant_service import get_llm_config
        cfg = get_llm_config()
        if cfg.get("provider") == provider:
            key = cfg.get("api_key", "")

    models = list_available_models(provider=provider.lower().strip(), api_key=key)
    return {"provider": provider, "models": models}


class LLMTestRequest(BaseModel):  # type: ignore[misc]
    provider: str = "anthropic"
    api_key: str = ""
    model: str = ""


@router.post("/test-llm-connection")
def test_llm_connection_endpoint(req: LLMTestRequest, db: Session = Depends(get_db)):
    """
    Send a minimal ping request to the configured LLM.
    Returns: {success, latency_ms, model_used, provider, error?}
    Error text is in plain English — no raw HTTP or markdown.
    """
    api_key = req.api_key
    model = req.model
    provider = req.provider.lower().strip()

    # Fall back to saved settings when caller doesn't supply key/model
    if not api_key or not model:
        from app.services.assistant_service import get_llm_config
        cfg = get_llm_config()
        api_key = api_key or cfg.get("api_key", "")
        model = model or cfg.get("model", "")
        provider = provider or cfg.get("provider", "anthropic")

    result = test_llm_connection(provider=provider, api_key=api_key, model=model)
    return result



# ─────────────────────────────────────────────
# Free-text Project Description Extraction
# ─────────────────────────────────────────────

DESCRIPTION_EXTRACTION_PROMPT = """\
You are a packaging engineering assistant. Extract structured product and packaging information from the user's free-text description.

Return ONLY valid JSON matching this schema (all fields optional, use null for unknown values):
{
  "name": "human-readable project name or null",
  "brand": "brand name or null",
  "model_number": "model/SKU or null",
  "product_type": "blender|stand_fan|ceiling_fan|washing_machine|refrigerator|air_conditioner|tv|kettle|microwave|water_heater|other or null",
  "sku": "barcode/EAN or null",
  "product_length_mm": number or null,
  "product_width_mm": number or null,
  "product_height_mm": number or null,
  "net_weight_kg": number or null,
  "fragility": "LOW|MEDIUM|HIGH|VERY_HIGH or null",
  "carton_length_mm": number or null,
  "carton_width_mm": number or null,
  "carton_height_mm": number or null,
  "board_type": "single_wall|double_wall|triple_wall or null",
  "units_per_carton": integer or null,
  "notes": "any other relevant detail or null"
}

Convert all dimensions to millimetres. Convert weights to kg. Do NOT invent data.
If the user says "about 50 cm", convert to 500 mm. Return null for any field not mentioned.
"""

_REQUIRED_FIELDS = [
    "product_length_mm", "product_width_mm", "product_height_mm",
    "net_weight_kg", "carton_length_mm", "carton_width_mm", "carton_height_mm",
]


@router.post("/extract-from-description", response_model=ProjectDraft)
def extract_from_description_endpoint(req: DescriptionExtractRequest, db: Session = Depends(get_db)):
    """
    Parse a free-text project description (English or Arabic) into structured fields.
    Uses hybrid deterministic regex extraction + LLM enrichment when available.
    Guarantees extraction works even when offline or without an API key.
    """
    from app.services.assistant_service import get_llm_config, call_anthropic_claude, call_gemini
    from app.services.extraction_service import deterministic_extract_from_text, merge_extractions
    import re
    import json

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Description text is required.")

    # 1. Deterministic extraction from user text
    det_data = deterministic_extract_from_text(req.text)

    # 2. Check LLM availability
    cfg = get_llm_config()
    api_key = cfg.get("api_key", "")
    provider = cfg.get("provider", "anthropic")
    model = cfg.get("model", "")

    llm_data = None
    llm_offline = not bool(api_key)

    if api_key:
        user_prompt = f"Extract packaging data from this description:\n\n{req.text.strip()}"
        try:
            if provider == "gemini":
                raw = call_gemini(user_prompt, api_key, model, [], DESCRIPTION_EXTRACTION_PROMPT)
            else:
                raw = call_anthropic_claude(user_prompt, api_key, model, [], DESCRIPTION_EXTRACTION_PROMPT)

            raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
            try:
                llm_data = json.loads(raw)
            except json.JSONDecodeError:
                m = re.search(r"\{[\s\S]+\}", raw)
                if m:
                    llm_data = json.loads(m.group(0))
        except Exception as exc:
            logger.warning("LLM extraction call failed, using deterministic results: %s", exc)

    # 3. Merge deterministic + LLM results
    draft = merge_extractions(det_data, llm_data)
    draft.llm_offline = llm_offline
    if llm_offline:
        draft.extraction_notes = "Extracted deterministically from your description (LLM offline)."
    elif llm_data:
        draft.extraction_notes = f"Extracted and verified via {provider} ({model})."
    else:
        draft.extraction_notes = "Extracted deterministically from your description."

    return draft


# ─────────────────────────────────────────────
# AI Recommendation Endpoints (Hybrid Verifiable)
# ─────────────────────────────────────────────

@router.get("/projects/{project_id}/recommendation", response_model=RecommendationRun)
def get_project_recommendation_endpoint(project_id: str, db: Session = Depends(get_db)):
    """
    Get or compute the active AI Recommendation for a project.
    Grounded in real product specs, McKee BCT calculation, and Euro Pallet geometry.
    """
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    opt = proj.optimization_result or {}
    if "ai_recommendation" in opt:
        return RecommendationRun(**opt["ai_recommendation"])

    # Generate fresh recommendation
    run = generate_recommendation_run(
        project_id=proj.id,
        product=_recommendation_product(db, proj),
        baseline=proj.baseline_data or {},
        enable_ai_reasoning=False,
    )

    # Persist in project's optimization result
    new_opt = dict(opt)
    new_opt["ai_recommendation"] = run.model_dump(mode="json")
    proj.optimization_result = new_opt
    db.commit()

    return run


@router.post("/projects/{project_id}/recommendation/reasoning", response_model=RecommendationRun)
def reason_project_recommendation_endpoint(project_id: str, db: Session = Depends(get_db)):
    """Run optional AI reasoning after the deterministic recommendation is available."""
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    opt = dict(proj.optimization_result or {})
    existing = opt.get("ai_recommendation", {})
    run = generate_recommendation_run(
        project_id=proj.id,
        product=_recommendation_product(db, proj),
        baseline=proj.baseline_data or {},
        locked_fields=existing.get("locked_fields"),
        enable_ai_reasoning=True,
    )
    run.refinement_history = existing.get("refinement_history", [])
    opt["ai_recommendation"] = run.model_dump(mode="json")
    proj.optimization_result = opt
    db.commit()
    return run


@router.post("/projects/{project_id}/recommendation", response_model=RecommendationRun)
def generate_project_recommendation_endpoint(project_id: str, db: Session = Depends(get_db)):
    """
    Force regenerate an AI packaging recommendation.
    """
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    run = generate_recommendation_run(
        project_id=proj.id,
        product=_recommendation_product(db, proj),
        baseline=proj.baseline_data or {},
    )

    opt = dict(proj.optimization_result or {})
    opt["ai_recommendation"] = run.model_dump(mode="json")
    proj.optimization_result = opt
    db.commit()

    return run


@router.post("/projects/{project_id}/recommendation/refine", response_model=RecommendationRun)
def refine_project_recommendation_endpoint(
    project_id: str,
    req: RefinementRequest,
    db: Session = Depends(get_db),
):
    """
    Refine recommendation using natural language prompt (e.g. 'make it cheaper', 'lock carton height 450')
    or locked dimension constraints. Re-verifies all engineering constraints deterministically.
    """
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    opt = dict(proj.optimization_result or {})
    existing_rec = opt.get("ai_recommendation", {})
    existing_locked = existing_rec.get("locked_fields", {})
    if req.locked_fields:
        existing_locked.update(req.locked_fields)

    run = generate_recommendation_run(
        project_id=proj.id,
        product=_recommendation_product(db, proj),
        baseline=proj.baseline_data or {},
        locked_fields=existing_locked,
        refinement_prompt=req.prompt,
    )

    # Append to refinement history
    history = existing_rec.get("refinement_history", [])
    history.append({
        "prompt": req.prompt,
        "timestamp": datetime.utcnow().isoformat(),
        "recommended_candidate": run.recommended.name,
    })
    run.refinement_history = history

    opt["ai_recommendation"] = run.model_dump(mode="json")
    proj.optimization_result = opt
    db.commit()

    return run


@router.post("/projects/{project_id}/recommendation/accept")
def accept_recommendation_candidate_endpoint(
    project_id: str,
    candidate_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Set one of the recommendation alternatives as the project's active design.
    """
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    opt = dict(proj.optimization_result or {})
    rec = opt.get("ai_recommendation")
    if not rec:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active recommendation run.")

    all_cands = [rec.get("recommended")] + rec.get("alternatives", [])
    target = next((c for c in all_cands if c and c.get("candidate_id") == candidate_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")

    # Swap target into recommended spot
    rec["recommended"]["is_recommended"] = False
    new_alts = [c for c in all_cands if c.get("candidate_id") != candidate_id]
    target["is_recommended"] = True
    rec["recommended"] = target
    rec["alternatives"] = new_alts

    opt["ai_recommendation"] = rec
    proj.optimization_result = opt
    db.commit()

    return {"status": "success", "active_design": target["name"]}


@router.post("/projects/{project_id}/recommendation/feedback")
def submit_recommendation_feedback_endpoint(
    project_id: str,
    feedback: RecommendationFeedback,
    db: Session = Depends(get_db),
):
    """
    Save user feedback (accept / reject with reason) for record-keeping.
    """
    proj = project_service.get_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    opt = dict(proj.optimization_result or {})
    if "ai_recommendation" in opt:
        opt["ai_recommendation"]["user_feedback"] = feedback.model_dump(mode="json")
        proj.optimization_result = opt
        db.commit()

    return {"status": "saved", "feedback": feedback.status}


# ─────────────────────────────────────────────
# Standards Registry & Test Plan
# ─────────────────────────────────────────────

@router.get("/standards")
def list_standards_registry_endpoint(db: Session = Depends(get_db)):
    """Return the editable, database-backed ISO and ISTA metadata catalog."""
    records = db.query(StandardsCatalogEntry).order_by(StandardsCatalogEntry.organization, StandardsCatalogEntry.standard_identifier).all()
    standards = [{
        "entry_id": record.entry_id,
        "organization": record.organization,
        "standard_identifier": record.standard_identifier,
        "title": record.title,
        "title_ar": record.title_ar,
        "scope_summary": record.scope_summary,
        "scope_summary_ar": record.scope_summary_ar,
        "what_it_tests": record.what_it_tests,
        "when_it_applies": record.when_it_applies,
        "source_url": record.source_url,
        "version": record.version,
        "last_verified_date": record.last_verified_date,
        "check_type": record.check_type,
        "applicability_rules": record.applicability_rules or {},
        "is_user_editable": record.is_user_editable,
        "added_by_me": record.is_user_editable,
        "verification_status": record.verification_status,
    } for record in records]
    iso_count = sum(item["organization"] == "ISO" for item in standards)
    ista_count = sum(item["organization"] == "ISTA" for item in standards)
    last_verified = max((item["last_verified_date"] or "" for item in standards), default="") or None
    evaluation_statement = f"Evaluated against: ISO registry v1 ({iso_count} entries) and ISTA registry v1 ({ista_count} entries), last verified {last_verified or 'date not recorded'}. No company-specific requirements loaded."
    return {
        "registry_version": "1",
        "standards_count": len(standards),
        "counts": {"ALL": len(standards), "ISO": iso_count, "ISTA": ista_count, "ADDED_BY_ME": sum(item["added_by_me"] for item in standards)},
        "last_verified_date": last_verified,
        "evaluation_statement": evaluation_statement,
        "standards": standards,
    }


class StandardsCatalogEntryInput(BaseModel):
    organization: str = Field(min_length=2, max_length=50)
    organization_other: Optional[str] = Field(default=None, max_length=50)
    standard_identifier: str = Field(min_length=3, max_length=120)
    title: str = Field(min_length=6, max_length=500)
    title_ar: Optional[str] = None
    scope_summary: str = Field(min_length=20, max_length=5000)
    scope_summary_ar: Optional[str] = None
    what_it_tests: str
    when_it_applies: str
    source_url: str = Field(default="", max_length=1000)
    version: Optional[str] = None
    last_verified_date: Optional[str] = None
    check_type: str = "PHYSICAL_TEST"
    applicability_rules: dict[str, Any] = {}

    @field_validator("organization", "organization_other", "standard_identifier", "title", "scope_summary", "source_url", mode="before")
    @classmethod
    def trim_standard_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db)):
    items = db.query(AppNotification).order_by(AppNotification.created_at.desc()).limit(50).all()
    unread_count = db.query(AppNotification).filter(AppNotification.is_read.is_(False)).count()
    return {"unread_count": unread_count, "notifications": [{
        "notification_id": item.notification_id, "title": item.title, "message": item.message,
        "details": item.details or {}, "is_read": item.is_read, "created_at": item.created_at,
    } for item in items]}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    item = db.query(AppNotification).filter(AppNotification.notification_id == notification_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found.")
    item.is_read = True
    db.commit()
    return {"notification_id": notification_id, "is_read": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(AppNotification).filter(AppNotification.is_read.is_(False)).update({AppNotification.is_read: True})
    db.commit()
    return {"status": "read"}


def _verify_standard_or_raise(req: StandardsCatalogEntryInput, db: Session) -> tuple[dict[str, Any], dict[str, Any]]:
    organization = req.organization.strip().upper()
    supported = {"ISO", "ISTA", "ASTM", "TAPPI", "FEFCO", "EN", "BS", "DIN"}
    if organization == "OTHER":
        organization = (req.organization_other or "").strip()
        if not organization:
            raise HTTPException(status_code=422, detail="Enter the name of the other standards organization.")
    elif organization not in supported:
        raise HTTPException(status_code=422, detail="Choose a listed organization or Other.")

    data = req.model_dump(exclude={"organization_other"})
    data["organization"] = organization
    from app.services.standards_validation_service import validate_standard_entry
    verification = validate_standard_entry({
        "organization": organization,
        "standard_identifier": data["standard_identifier"],
        "title": data["title"],
        "version": data.get("version"),
        "source_url": data.get("source_url"),
        "scope_summary": data["scope_summary"],
    })
    if not verification["valid"]:
        identifier = data["standard_identifier"]
        reason = verification["reason"]
        notification = AppNotification(
            title=f"Standard refused: {identifier}",
            message=f"Standard refused: {identifier}. Reason: {reason}",
            details={"verification": verification, "entered": {k: data.get(k) for k in ("organization", "standard_identifier", "title", "version", "source_url")}},
            is_read=False,
        )
        db.add(notification)
        db.commit()
        raise HTTPException(status_code=422, detail={
            "message": notification.message,
            "notification_id": notification.notification_id,
            "verification": verification,
        })
    return data, verification


@router.post("/standards", status_code=status.HTTP_201_CREATED)
def create_standards_catalog_entry(req: StandardsCatalogEntryInput, db: Session = Depends(get_db)):
    data, verification = _verify_standard_or_raise(req, db)
    if not data.get("source_url"):
        data["source_url"] = verification.get("found", {}).get("source_url") or (verification.get("sources") or [{}])[0].get("url", "")
    data["last_verified_date"] = datetime.now().date().isoformat()
    organization = data["organization"]
    entry_id = f"{organization}-{uuid.uuid4()}"
    record = StandardsCatalogEntry(entry_id=entry_id, **data, is_user_editable=True, verification_status="Verified")
    db.add(record)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A standard with that identifier already exists.") from exc
    return {"entry_id": entry_id, "status": "created"}


@router.put("/standards/{entry_id}")
def update_standards_catalog_entry(entry_id: str, req: StandardsCatalogEntryInput, db: Session = Depends(get_db)):
    record = db.query(StandardsCatalogEntry).filter(StandardsCatalogEntry.entry_id == entry_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Standard not found.")
    if not record.is_user_editable:
        raise HTTPException(status_code=403, detail="Built-in registry entries are read-only; add a project-specific entry instead.")
    data, verification = _verify_standard_or_raise(req, db)
    if not data.get("source_url"):
        data["source_url"] = verification.get("found", {}).get("source_url") or (verification.get("sources") or [{}])[0].get("url", "")
    data["last_verified_date"] = datetime.now().date().isoformat()
    data["verification_status"] = "Verified"
    for key, value in data.items():
        setattr(record, key, value)
    db.commit()
    return {"entry_id": entry_id, "status": "updated"}


@router.get("/standards/test-plan")
@router.post("/standards/test-plan")
def generate_standards_test_plan_endpoint(
    weight_kg: Optional[float] = Query(None, description="Product weight in kg"),
    channel: Optional[str] = Query(None, description="Shipping mode"),
    fragility: str = Query("MEDIUM", description="Fragility class"),
):
    """Suggest applicable procedures without specifying lab test levels."""
    from app.standards.registry import generate_test_plan
    return generate_test_plan(product_weight_kg=weight_kg, distribution_channel=channel, fragility=fragility)


@router.get("/projects/{project_id}/test-plan")
def get_project_test_plan(project_id: str, db: Session = Depends(get_db)):
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    product = project.product_data or {}
    from app.standards.registry import generate_test_plan
    return generate_test_plan(
        product_weight_kg=product.get("weight_kg"),
        distribution_channel=product.get("shipping_mode"),
        fragility=product.get("fragility_class", "MEDIUM"),
    )


# ─────────────────────────────────────────────
# Product Image Proxy (CORS & Hotlink Safe)
# ─────────────────────────────────────────────

@router.get("/image-proxy")
def image_proxy_endpoint(url: str = Query(..., description="External image URL to proxy")):
    """
    Safely proxy product images (e.g. from El Araby Group official catalog)
    to bypass browser CORS restrictions and hotlink blocks. Validates against SSRF.
    """
    if not is_ssrf_safe_url(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disallowed or private IP destination.",
        )

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NxtPakAI/1.0",
                "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Referer": "https://www.elarabygroup.com/",
            },
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            content_type = resp.headers.get_content_type() or "image/jpeg"
            data = resp.read()
            return Response(
                content=data,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception as e:
        logger.info("Image proxy remote request failed for %s (%s) — returning SVG placeholder", url, e)
        # Return elegant SVG product placeholder representing the appliance catalog image
        svg = """<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="#292524" rx="12"/>
            <rect x="24" y="24" width="352" height="352" fill="none" stroke="#44403c" stroke-width="2" stroke-dasharray="6,6" rx="8"/>
            <circle cx="200" cy="170" r="45" fill="#1c1917" stroke="#d97706" stroke-width="2"/>
            <path d="M185 170 L215 170 M200 155 L200 185" stroke="#d97706" stroke-width="3" stroke-linecap="round"/>
            <text x="200" y="245" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#f5f5f4">El Araby Verified Product</text>
            <text x="200" y="268" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#a8a29e">Physical Reference Geometry</text>
        </svg>"""
        return Response(content=svg.encode("utf-8"), media_type="image/svg+xml")
