"""
NxtPak AI — File Export Coordinator
Manages file generation (PDF, HTML, JSON, GLB), validation, and delivery.
Never marks unsupported formats as complete.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings
from app.geometry.engine_interface import GeometryEngine
from app.reporting.report_generator import ReportGenerator
from app.schemas.schemas import ExportResult
from app.validation.validator import validate_export_file

logger = logging.getLogger(__name__)


class Exporter:
    """
    Coordinates export file creation and validation.
    """

    def __init__(self, export_dir: Optional[str] = None):
        self.export_dir = Path(export_dir or settings.export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)
        self.report_gen = ReportGenerator(str(self.export_dir))
        self.geom_engine = GeometryEngine()

    def export_report(
        self,
        project_data: dict[str, Any],
        format_type: str = "pdf",
    ) -> ExportResult:
        """
        Generate and validate a report in the specified format (pdf, html, json).
        """
        fmt = format_type.lower()
        project_id = project_data.get("id") or project_data.get("project_id", "project")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        file_name = f"nxtpak_{project_id}_{timestamp}.{fmt}"
        file_path: Optional[str] = None

        if fmt == "pdf":
            file_path = self.report_gen.generate_pdf(project_data, file_name=file_name)
        elif fmt == "html":
            file_path = self.report_gen.generate_html(project_data, file_name=file_name)
        elif fmt == "json":
            file_path = self.report_gen.generate_json(project_data, file_name=file_name)
        else:
            raise ValueError(f"Unsupported report export format: {format_type}")

        # Validate file
        val = validate_export_file(file_path)
        p = Path(file_path)
        size = p.stat().st_size if p.exists() else 0

        return ExportResult(
            file_path=str(p.resolve()),
            file_name=file_name,
            format=fmt,
            size_bytes=size,
            generated_at=datetime.now(timezone.utc),
            is_valid=val.is_valid,
            validation_notes=val.errors + val.warnings,
        )

    def export_glb(
        self,
        outer_dims_mm: dict[str, float],
        product_dims_mm: dict[str, float],
        project_id: str,
    ) -> Optional[ExportResult]:
        """
        Export 3D GLB model file if supported by active geometry engine.
        """
        glb_bytes = self.geom_engine.export_glb_bytes(outer_dims_mm, product_dims_mm)
        if not glb_bytes:
            return None

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        file_name = f"nxtpak_{project_id}_{timestamp}.glb"
        file_path = self.export_dir / file_name

        with open(file_path, "wb") as f:
            f.write(glb_bytes)

        val = validate_export_file(str(file_path))
        return ExportResult(
            file_path=str(file_path.resolve()),
            file_name=file_name,
            format="glb",
            size_bytes=len(glb_bytes),
            generated_at=datetime.now(timezone.utc),
            is_valid=val.is_valid,
            validation_notes=val.errors + val.warnings,
        )

    def cleanup_old_exports(self, max_age_hours: Optional[int] = None) -> int:
        """Remove exports older than configured max age."""
        hours = max_age_hours or settings.max_export_age_hours
        cutoff = time.time() - (hours * 3600)
        removed = 0
        for p in self.export_dir.glob("*"):
            if p.is_file() and p.stat().st_mtime < cutoff:
                try:
                    p.unlink()
                    removed += 1
                except Exception as e:
                    logger.warning("Could not delete old export %s: %s", p, e)
        return removed
