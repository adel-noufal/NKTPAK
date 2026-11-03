"""
NxtPak AI — Project Service (Production).
CRUD operations, duplicate detection, global search/filter, and system settings.
Zero seed fixtures in runtime path.
"""

from __future__ import annotations

import logging
import json
from typing import Any, Optional, List, Dict
from datetime import datetime, timezone

from sqlalchemy import select, delete, update, or_, and_
from sqlalchemy.orm import Session

from app.models.models import Project, SystemSettings
from app.schemas.schemas import ProjectCreate, AdminSettingsUpdate, AdminSettingsResponse, DimensionsInput, ComponentInput
from app.optimization.foam import CushionMaterial, empty_material_library

logger = logging.getLogger(__name__)


def check_existing_product(
    db: Session, brand: str, model_number: str, sku: Optional[str] = None
) -> Optional[Project]:
    """
    Check if a product with the same brand and model (and SKU if provided)
    already exists in the database.
    """
    query = select(Project).where(
        Project.brand.ilike(brand.strip()),
        Project.model_number.ilike(model_number.strip()),
    )
    if sku and sku.strip():
        query = query.where(Project.sku.ilike(sku.strip()))
    return db.execute(query.order_by(Project.created_at.desc())).scalars().first()


def create_project(
    db: Session,
    project_in: ProjectCreate,
    pipeline_result: Optional[dict[str, Any]] = None,
) -> Project:
    """Save a new project with its calculated pipeline results into the database."""
    status = "completed" if pipeline_result else "draft"
    prod = project_in.product

    canonical_components = project_in.components or prod.components
    product_data = prod.model_dump(mode="json")
    product_data["components"] = [c.model_dump(mode="json") for c in canonical_components]
    proj = Project(
        name=project_in.name,
        brand=prod.brand,
        model_number=prod.model or "",
        sku=prod.sku,
        description=project_in.description,
        status=status,
        language=project_in.language,
        product_data=product_data,
        components_data=[c.model_dump(mode="json") for c in canonical_components],
        baseline_data=project_in.baseline.model_dump(mode="json"),
        planned_data=project_in.planned.model_dump(mode="json") if project_in.planned else None,
        optimization_config=project_in.optimization_config.model_dump(mode="json"),
        optimization_result=pipeline_result.get("optimization_result") if pipeline_result else None,
        standards_result=pipeline_result.get("standards_result") if pipeline_result else None,
        selected_alternative_id=(
            pipeline_result.get("optimization_result", {}).get("recommended", {}).get("alternative_id")
            if pipeline_result
            else None
        ),
        chat_history=[],
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


def get_project(db: Session, project_id: str) -> Optional[Project]:
    """Retrieve project by ID."""
    res = db.execute(select(Project).where(Project.id == project_id))
    return res.scalar_one_or_none()


def list_projects(
    db: Session,
    search: Optional[str] = None,
    brand: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Project]:
    """List projects with search, filter, and ordering by recent updates."""
    query = select(Project)

    conditions = []
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Project.name.ilike(term),
                Project.brand.ilike(term),
                Project.model_number.ilike(term),
                Project.sku.ilike(term),
            )
        )
    if brand and brand.strip():
        conditions.append(Project.brand.ilike(f"%{brand.strip()}%"))
    if status and status.strip():
        conditions.append(Project.status == status.strip())

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Project.updated_at.desc()).limit(limit).offset(offset)
    res = db.execute(query)
    return list(res.scalars().all())


def update_project(db: Session, project_id: str, update_data: dict[str, Any]) -> Optional[Project]:
    """Partial update of a project record."""
    proj = get_project(db, project_id)
    if not proj:
        return None

    for field, val in update_data.items():
        if field == "product_data" and isinstance(val, dict):
            current = dict(proj.product_data or {})
            merged = {**current, **val}
            if isinstance(current.get("packed_dimensions"), dict) and isinstance(val.get("packed_dimensions"), dict):
                merged["packed_dimensions"] = {**current["packed_dimensions"], **val["packed_dimensions"]}
            if "packed_dimensions" in val:
                dims = merged.get("packed_dimensions")
                if not isinstance(dims, dict):
                    raise ValueError("Product dimensions are required and must be provided in millimetres.")
                DimensionsInput(**dims)
            if "weight_kg" in val and (not isinstance(merged.get("weight_kg"), (int, float)) or merged["weight_kg"] <= 0):
                raise ValueError("Product weight must be greater than zero kg.")
            if "product_type" in val and merged.get("product_type") not in {"blender", "stand_fan", "ceiling_fan", "washing_machine", "refrigerator", "air_conditioner", "tv", "kettle", "microwave", "water_heater", "other"}:
                raise ValueError("Product type is not supported.")
            if "components" in val:
                if not isinstance(merged["components"], list):
                    raise ValueError("Product components must be a list.")
                merged["components"] = [ComponentInput(**component).model_dump(mode="json") for component in merged["components"]]
            if isinstance(current.get("provenance"), dict) and isinstance(val.get("provenance"), dict):
                merged["provenance"] = {**current["provenance"], **val["provenance"]}
            # Keep the one canonical component list mirrored for older API consumers.
            if "components" in merged:
                proj.components_data = merged["components"]
            setattr(proj, field, merged)
            continue
        if hasattr(proj, field):
            setattr(proj, field, val)

    proj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proj)
    return proj


def delete_project(db: Session, project_id: str) -> bool:
    """Delete a project by ID."""
    res = db.execute(delete(Project).where(Project.id == project_id))
    db.commit()
    return res.rowcount > 0


def append_chat_turn(db: Session, project_id: str, user_msg: str, assistant_msg: str) -> None:
    """Append a user/assistant turn to project's chat history."""
    proj = get_project(db, project_id)
    if not proj:
        return

    history = list(proj.chat_history or [])
    now_str = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": user_msg, "timestamp": now_str})
    history.append({"role": "assistant", "content": assistant_msg, "timestamp": now_str})

    proj.chat_history = history
    db.commit()


# ─────────────────────────────────────────────
# Admin Settings Persistence
# ─────────────────────────────────────────────

def get_admin_settings(db: Session) -> AdminSettingsResponse:
    """Retrieve system settings from database."""
    rows = db.query(SystemSettings).all()
    data: Dict[str, Any] = {}
    for r in rows:
        data[r.key] = r.value

    return AdminSettingsResponse(
        llm_provider=data.get("llm_provider", "anthropic"),
        llm_model=data.get("llm_model", "claude-3-5-sonnet-20241022"),
        llm_configured=bool(data.get("llm_api_key")),
        default_clearance_mm=float(data.get("default_clearance_mm", 20.0)),
        default_board_cost_per_m2=float(data.get("default_board_cost_per_m2", 25.0)),
        currency=data.get("currency", "EGP"),
    )


def update_admin_settings(db: Session, settings_in: AdminSettingsUpdate) -> AdminSettingsResponse:
    """Save admin settings to database."""
    fields = settings_in.model_dump(exclude_unset=True)
    for k, v in fields.items():
        if v is not None:
            obj = db.query(SystemSettings).filter(SystemSettings.key == k).first()
            if not obj:
                obj = SystemSettings(key=k, value=str(v))
                db.add(obj)
            else:
                obj.value = str(v)
    db.commit()
    return get_admin_settings(db)


def get_foam_materials(db: Session) -> list[CushionMaterial]:
    """Load editable cushioning records, leaving unknown supplier properties unset."""
    setting = db.query(SystemSettings).filter(SystemSettings.key == "foam_materials").first()
    if not setting:
        return empty_material_library()
    try:
        raw_materials = json.loads(setting.value)
        return [CushionMaterial.model_validate(item) for item in raw_materials]
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.exception("Stored foam material library is invalid")
        raise


def update_foam_materials(db: Session, materials: list[CushionMaterial]) -> list[CushionMaterial]:
    ids = [material.material_id for material in materials]
    if len(ids) != len(set(ids)):
        raise ValueError("Foam material IDs must be unique.")
    setting = db.query(SystemSettings).filter(SystemSettings.key == "foam_materials").first()
    value = json.dumps([material.model_dump(mode="json") for material in materials])
    if setting:
        setting.value = value
    else:
        db.add(SystemSettings(key="foam_materials", value=value))
    for project in db.query(Project).all():
        if project.optimization_result and project.optimization_result.get("ai_recommendation"):
            result = dict(project.optimization_result)
            result.pop("ai_recommendation", None)
            project.optimization_result = result
    db.commit()
    return get_foam_materials(db)
