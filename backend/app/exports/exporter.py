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
        elif fmt == "dxf":
            file_path = self.generate_dxf_dieline(project_data, file_name=file_name)
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

    def generate_dxf_dieline(self, project_data: dict[str, Any], file_name: str) -> str:
        """
        Generate FEFCO 0201 standard carton dieline in ASCII DXF format.
        Produces distinct CUT (solid border) and CREASE (fold lines) layers.
        """
        opt = project_data.get("optimization_result", {})
        rec = opt.get("recommended") or {}
        l = float(rec.get("outer_length_mm") or 500.0)
        w = float(rec.get("outer_width_mm") or 350.0)
        h = float(rec.get("outer_height_mm") or 400.0)

        flap_h = w / 2.0
        glue_w = 35.0
        total_w = glue_w + 2 * l + 2 * w
        total_h = h + 2 * flap_h

        lines: list[tuple[float, float, float, float, str]] = []
        # Outer CUT boundary
        lines.append((0.0, 0.0, total_w, 0.0, "CUT"))
        lines.append((total_w, 0.0, total_w, total_h, "CUT"))
        lines.append((total_w, total_h, 0.0, total_h, "CUT"))
        lines.append((0.0, total_h, 0.0, 0.0, "CUT"))

        # CREASE lines: Top and Bottom flaps
        lines.append((0.0, flap_h, total_w, flap_h, "CREASE"))
        lines.append((0.0, flap_h + h, total_w, flap_h + h, "CREASE"))

        # CREASE lines: Panel folds
        x_positions = [glue_w, glue_w + l, glue_w + l + w, glue_w + 2 * l + w]
        for xp in x_positions:
            lines.append((xp, flap_h, xp, flap_h + h, "CREASE"))
            # Flap slits on CUT layer
            lines.append((xp, 0.0, xp, flap_h, "CUT"))
            lines.append((xp, flap_h + h, xp, total_h, "CUT"))

        # Build ASCII DXF
        dxf_parts = ["0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"]
        for x1, y1, x2, y2, layer in lines:
            dxf_parts.append(
                f"0\nLINE\n8\n{layer}\n10\n{x1:.2f}\n20\n{y1:.2f}\n30\n0.0\n11\n{x2:.2f}\n21\n{y2:.2f}\n31\n0.0\n"
            )
        dxf_parts.append("0\nENDSEC\n0\nEOF\n")

        file_path = self.export_dir / file_name
        with open(file_path, "w", encoding="ascii") as f:
            f.write("".join(dxf_parts))

        return str(file_path.resolve())

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
