"""
NxtPak AI — Project Service (Revision v6)
Database operations, draft project creation, and example project loader.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone

from sqlalchemy import select, delete, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Project
from app.schemas.schemas import ProjectCreate

logger = logging.getLogger(__name__)


def create_project(
    db: Session,
    project_in: ProjectCreate,
    pipeline_result: Optional[dict[str, Any]] = None,
) -> Project:
    """Save a new project with its pipeline results into the database."""
    status = "completed" if pipeline_result else "draft"
    proj = Project(
        name=project_in.name,
        description=project_in.description,
        status=status,
        language=project_in.language,
        product_data=project_in.product.model_dump(mode="json"),
        components_data=[c.model_dump(mode="json") for c in project_in.components],
        baseline_data=project_in.baseline.model_dump(mode="json") if project_in.baseline else None,
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


def create_draft_project(db: Session, data: dict[str, Any]) -> Project:
    """Create a draft project from raw dict data (used by example loader)."""
    prod = data.get("product", {})
    proj = Project(
        name=data.get("name", "Draft Project"),
        description=data.get("description"),
        status="draft",
        language="en",
        product_data={
            **prod,
            # Store supplemental fields in product_data
            "datasheet_notes": data.get("datasheet_notes", []),
            "technical_specs": data.get("technical_specs", {}),
            "component_suggestions": data.get("component_suggestions", []),
        },
        components_data=data.get("components", []),
        baseline_data=data.get("baseline"),
        planned_data=data.get("planned"),
        optimization_config=data.get("optimization_config", {}),
        optimization_result=None,
        standards_result=None,
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


def list_projects(db: Session, limit: int = 50, offset: int = 0) -> list[Project]:
    """List projects ordered by recent updates."""
    query = select(Project).order_by(Project.updated_at.desc()).limit(limit).offset(offset)
    res = db.execute(query)
    return list(res.scalars().all())


def delete_project(db: Session, project_id: str) -> bool:
    """Delete a project by ID."""
    res = db.execute(delete(Project).where(Project.id == project_id))
    db.commit()
    return res.rowcount > 0


def update_project(db: Session, project_id: str, update_data: dict[str, Any]) -> Optional[Project]:
    """Update specific fields on a project."""
    proj = get_project(db, project_id)
    if not proj:
        return None
    allowed = {
        "product_data", "components_data", "baseline_data", "planned_data",
        "optimization_config", "optimization_result", "standards_result",
        "selected_alternative_id", "status", "name", "description",
    }
    for key, val in update_data.items():
        if key in allowed:
            setattr(proj, key, val)
    proj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proj)
    return proj


def append_chat_turn(
    db: Session,
    project_id: str,
    user_msg: str,
    assistant_msg: str,
) -> None:
    """Append a user/assistant turn to the project's chat history."""
    proj = get_project(db, project_id)
    if not proj:
        return
    history = list(getattr(proj, "chat_history", None) or [])
    now = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": user_msg, "timestamp": now})
    history.append({"role": "assistant", "content": assistant_msg, "timestamp": now})
    proj.chat_history = history
    proj.updated_at = datetime.now(timezone.utc)
    db.commit()


def list_example_projects() -> list[dict[str, Any]]:
    """Scan and list all example projects in data/product_examples/."""
    examples_dir = Path(settings.product_examples_dir)
    results = []
    if not examples_dir.exists():
        return results

    for p in sorted(examples_dir.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                results.append({
                    "example_id": data.get("example_id"),
                    "example_name": data.get("example_name"),
                    "model": data.get("model"),
                    "brand": data.get("brand"),
                    "description": data.get("description"),
                    "data_label": data.get("data_label"),
                    "provenance": data.get("provenance", {}),
                    "component_suggestions": data.get("component_suggestions", []),
                })
        except Exception as e:
            logger.warning("Could not read example file %s: %s", p, e)
    return results


def get_example_project(example_id: str) -> Optional[dict[str, Any]]:
    """Retrieve full example project data by its ID."""
    examples_dir = Path(settings.product_examples_dir)
    if not examples_dir.exists():
        return None

    for p in examples_dir.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("example_id") == example_id:
                    return data
        except Exception:
            continue
    return None
