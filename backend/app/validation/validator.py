"""
NxtPak AI — Validation Component
Dimensional consistency, configured constraints, unsupported assumptions,
and export file validity checks.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional


class ValidationResult:

    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)


def validate_product_dims(
    length_mm: float,
    width_mm: float,
    height_mm: float,
    weight_kg: float,
) -> ValidationResult:
    """Validate raw product dimensions and weight."""
    res = ValidationResult()

    dims = [("Length", length_mm), ("Width", width_mm), ("Height", height_mm)]
    for name, val in dims:
        if val <= 0:
            res.add_error(f"{name} must be greater than 0 mm (got {val}).")
        elif val > 10000:
            res.add_error(f"{name} exceeds reasonable limit of 10,000 mm (got {val}).")
        elif val < 5:
            res.add_warning(f"{name} is unusually small (< 5 mm).")

    if weight_kg <= 0:
        res.add_error(f"Weight must be greater than 0 kg (got {weight_kg}).")
    elif weight_kg > 5000:
        res.add_error(f"Weight exceeds 5,000 kg limit (got {weight_kg}).")
    elif weight_kg < 0.005:
        res.add_warning(f"Weight is very low (< 5g).")

    return res


def validate_baseline(baseline: Optional[dict[str, Any]]) -> ValidationResult:
    """Validate user-entered baseline packaging if provided."""
    res = ValidationResult()
    if not baseline:
        return res

    outer_L = baseline.get("carton_outer_length_mm", 0)
    outer_W = baseline.get("carton_outer_width_mm", 0)
    outer_H = baseline.get("carton_outer_height_mm", 0)
    board_th = baseline.get("board_thickness_mm", 0)

    for name, val in [("Length", outer_L), ("Width", outer_W), ("Height", outer_H)]:
        if val <= 0:
            res.add_error(f"Baseline outer {name} must be > 0 mm.")

    if board_th <= 0:
        res.add_error(f"Baseline board thickness must be > 0 mm.")
    elif board_th > 50:
        res.add_error(f"Baseline board thickness ({board_th} mm) exceeds 50 mm limit.")

    if outer_L > 0 and 2 * board_th >= outer_L:
        res.add_error("Baseline board thickness exceeds carton length.")
    if outer_W > 0 and 2 * board_th >= outer_W:
        res.add_error("Baseline board thickness exceeds carton width.")
    if outer_H > 0 and 2 * board_th >= outer_H:
        res.add_error("Baseline board thickness exceeds carton height.")

    return res


def validate_export_file(file_path: str) -> ValidationResult:
    """Check that an export file exists, is non-empty, and has an approved extension."""
    res = ValidationResult()
    p = Path(file_path)

    if not p.exists():
        res.add_error(f"Export file not found at: {file_path}")
        return res

    size = p.stat().st_size
    if size == 0:
        res.add_error(f"Export file is empty (0 bytes): {file_path}")

    allowed_exts = {".pdf", ".html", ".json", ".glb"}
    if p.suffix.lower() not in allowed_exts:
        res.add_warning(f"Export file extension '{p.suffix}' is non-standard.")

    return res
