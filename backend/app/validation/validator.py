"""
NxtPak AI — Input Validation
All dimension, weight, baseline, and file validation logic.
No business logic beyond constraint checking.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Dimension constraints (configurable via this module, not magic literals elsewhere) ──
DIM_MIN_MM = 1.0
DIM_MAX_MM = 10_000.0
WEIGHT_MIN_KG = 0.001
WEIGHT_MAX_KG = 5_000.0
BOARD_MIN_MM = 0.5
BOARD_MAX_MM = 50.0
CLEARANCE_MIN_MM = 0.0  # 0 is allowed in OptimizationConfig, but engine checks > 0
CLEARANCE_POSITIVE_MM = 0.001  # must be strictly positive for engine use

ALLOWED_EXPORT_EXTENSIONS = {".pdf", ".html", ".json", ".glb", ".dxf"}


@dataclass
class ValidationResult:
    errors: list[str]
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors


def validate_product_dims(
    L: float, W: float, H: float, weight: float
) -> ValidationResult:
    """
    Validate product packed dimensions (mm) and weight (kg).
    Returns a list of error strings. Empty list = valid.
    """
    errors: list[str] = []

    for name, val in [("length", L), ("width", W), ("height", H)]:
        if val <= 0:
            errors.append(f"{name.title()} must be greater than 0 mm; got {val}.")
        elif val < DIM_MIN_MM:
            errors.append(f"Dimension '{name}' = {val} mm is below minimum ({DIM_MIN_MM} mm).")
        elif val > DIM_MAX_MM:
            errors.append(
                f"Dimension '{name}' = {val} mm exceeds reasonable limit ({DIM_MAX_MM} mm). Please verify."
            )

    if weight <= 0:
        errors.append(f"Weight must be greater than 0 kg; got {weight}.")
    elif weight < WEIGHT_MIN_KG:
        errors.append(f"Weight {weight} kg is implausibly small (< {WEIGHT_MIN_KG} kg).")
    elif weight > WEIGHT_MAX_KG:
        errors.append(
            f"Weight {weight} kg exceeds maximum ({WEIGHT_MAX_KG} kg). Please verify."
        )

    return ValidationResult(errors)


def validate_baseline(baseline_dict: dict[str, Any]) -> ValidationResult:
    """
    Validate a baseline packaging dict.
    Returns a list of error strings. Empty list = valid.
    """
    errors: list[str] = []

    for dim_key in ("carton_outer_length_mm", "carton_outer_width_mm", "carton_outer_height_mm"):
        val = baseline_dict.get(dim_key)
        if val is None:
            errors.append(f"Baseline missing required field: '{dim_key}'.")
        elif not isinstance(val, (int, float)):
            errors.append(f"Baseline '{dim_key}' must be numeric; got {type(val).__name__}.")
        elif val <= 0:
            errors.append(f"Baseline '{dim_key}' must be > 0 mm; got {val}.")
        elif val > DIM_MAX_MM:
            errors.append(f"Baseline '{dim_key}' = {val} mm exceeds {DIM_MAX_MM} mm limit.")

    board = baseline_dict.get("board_thickness_mm")
    if board is None:
        errors.append("Baseline missing required field: 'board_thickness_mm'.")
    elif not isinstance(board, (int, float)):
        errors.append(f"Baseline 'board_thickness_mm' must be numeric; got {type(board).__name__}.")
    elif board < BOARD_MIN_MM:
        errors.append(f"Baseline 'board_thickness_mm' = {board} mm is below minimum ({BOARD_MIN_MM} mm).")
    elif board > BOARD_MAX_MM:
        errors.append(f"Baseline 'board_thickness_mm' = {board} mm exceeds maximum ({BOARD_MAX_MM} mm).")

    # Cost fields: optional but must be non-negative if present
    for cost_key in ("carton_cost_per_unit", "total_insert_cost_per_unit"):
        val = baseline_dict.get(cost_key)
        if val is not None:
            if not isinstance(val, (int, float)):
                errors.append(f"Baseline '{cost_key}' must be numeric if provided.")
            elif val < 0:
                errors.append(f"Baseline '{cost_key}' must be >= 0; got {val}.")

    length = baseline_dict.get("carton_outer_length_mm")
    if isinstance(length, (int, float)) and isinstance(board, (int, float)) and board * 2 >= length:
        errors.append("Board thickness exceeds carton length clearance.")
    return ValidationResult(errors)


def validate_alternative_dims(alt: dict[str, Any]) -> ValidationResult:
    """
    Validate a generated packaging alternative dict.
    Checks:
    - Inner dims > 0
    - Outer dims > inner dims
    - Board thickness consistent (outer - inner) / 2 ≈ board_thickness
    - Inner dims > product dims (no penetration)
    Returns a list of error strings.
    """
    errors: list[str] = []

    outer_L = alt.get("outer_length_mm", 0.0)
    outer_W = alt.get("outer_width_mm", 0.0)
    outer_H = alt.get("outer_height_mm", 0.0)
    inner_L = alt.get("inner_length_mm", 0.0)
    inner_W = alt.get("inner_width_mm", 0.0)
    inner_H = alt.get("inner_height_mm", 0.0)
    board = alt.get("board_thickness_mm", 0.0)

    for axis, outer, inner in [("L", outer_L, inner_L), ("W", outer_W, inner_W), ("H", outer_H, inner_H)]:
        if inner <= 0:
            errors.append(f"Inner dimension {axis} must be > 0 mm; got {inner}.")
        if outer <= inner:
            errors.append(
                f"Outer {axis} ({outer} mm) must be greater than inner {axis} ({inner} mm)."
            )
        if board > 0:
            expected_inner = outer - 2 * board
            diff = abs(inner - expected_inner)
            if diff > 1.0:  # 1 mm tolerance
                errors.append(
                    f"Inner {axis} = {inner} mm inconsistent with outer {outer} mm - 2×board {board} mm = {expected_inner} mm "
                    f"(diff = {diff:.2f} mm > 1 mm tolerance)."
                )

    if board < BOARD_MIN_MM:
        errors.append(
            f"board_thickness_mm = {board} mm is below minimum ({BOARD_MIN_MM} mm)."
        )
    if board > BOARD_MAX_MM:
        errors.append(
            f"board_thickness_mm = {board} mm exceeds maximum ({BOARD_MAX_MM} mm)."
        )

    # Check inner > product dims if product dims are included
    product_L = alt.get("product_L_mm")
    product_W = alt.get("product_W_mm")
    product_H = alt.get("product_H_mm")
    if product_L and inner_L <= product_L:
        errors.append(
            f"Inner L ({inner_L} mm) must be > product L ({product_L} mm)."
        )
    if product_W and inner_W <= product_W:
        errors.append(
            f"Inner W ({inner_W} mm) must be > product W ({product_W} mm)."
        )
    if product_H and inner_H <= product_H:
        errors.append(
            f"Inner H ({inner_H} mm) must be > product H ({product_H} mm)."
        )

    return ValidationResult(errors)


def validate_export_file(filepath: str) -> ValidationResult:
    """
    Validate that an export file exists, is > 0 bytes, and has a supported extension.
    Returns a list of error strings. Empty list = valid.
    """
    errors: list[str] = []
    p = Path(filepath)

    if not p.exists():
        errors.append(f"Export file not found: {filepath}")
        return ValidationResult(errors)

    if not p.is_file():
        errors.append(f"Path is not a regular file: {filepath}")
        return ValidationResult(errors)

    size = p.stat().st_size
    if size == 0:
        errors.append(f"Export file is empty (0 bytes): {filepath}")

    ext = p.suffix.lower()
    if ext not in ALLOWED_EXPORT_EXTENSIONS:
        errors.append(
            f"Unsupported export extension '{ext}'. "
            f"Allowed: {sorted(ALLOWED_EXPORT_EXTENSIONS)}"
        )

    return ValidationResult(errors)
