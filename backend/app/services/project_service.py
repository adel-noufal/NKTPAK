"""
NxtPak AI — Project Service
Database operations and example projects loader.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone

from sqlalchemy import select, delete
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
    proj = Project(
        name=project_in.name,
        description=project_in.description,
        status="completed" if pipeline_result else "draft",
        language=project_in.language,
        product_data=project_in.product.model_dump(mode="json"),
        baseline_data=project_in.baseline.model_dump(mode="json") if project_in.baseline else None,
        optimization_config=project_in.optimization_config.model_dump(mode="json"),
        optimization_result=pipeline_result.get("optimization_result") if pipeline_result else None,
        standards_result=pipeline_result.get("standards_result") if pipeline_result else None,
        selected_alternative_id=(
            pipeline_result.get("optimization_result", {}).get("recommended", {}).get("alternative_id")
            if pipeline_result
            else None
        ),
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


def list_example_projects() -> list[dict[str, Any]]:
    """Scan and list all example projects in data/product_examples/."""
    examples_dir = Path(settings.product_examples_dir)
    results = []
    if not examples_dir.exists():
        return results

    for p in examples_dir.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                results.append({
                    "example_id": data.get("example_id"),
                    "example_name": data.get("example_name"),
                    "description": data.get("description"),
                    "data_label": data.get("data_label"),
                    "data_warning": data.get("data_warning"),
                    "file_path": str(p),
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
