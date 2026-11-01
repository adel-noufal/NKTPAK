"""
NxtPak AI — Product Specs Agent
Validates and normalizes product input. Converts all dimensions to mm internally.
Never invents missing measurements. Records provenance for all values.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.schemas.schemas import (
    DataLabel,
    FragilityClass,
    ProductInput,
)

logger = logging.getLogger(__name__)

# Assumption: fragility class affects insert strategy, not dimensions.
# Assumption: all weight and dimension conversions are exact (no rounding at this stage).

UNIT_TO_MM: dict[str, float] = {
    "mm": 1.0,
    "cm": 10.0,
    "m": 1000.0,
    "inch": 25.4,
}

VALID_FRAGILITY_CLASSES = {fc.value for fc in FragilityClass}


class ProductSpecsValidationError(Exception):
    """Raised when product specs cannot be normalized."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


class ProductSpecsAgent:
    """
    Validates and normalizes a ProductInput schema into an internal product dict.

    Assumptions recorded:
    - Dimensions are the outer packed dimensions of the product (including any product packaging, e.g., a blister pack).
    - Weight is the total packed weight as entered by the user.
    - Fragility class is user-selected and not independently verified.
    - Provenance is USER_ENTERED unless the user provides a Provenance object.
    """

    def normalize(self, product_input: ProductInput) -> dict[str, Any]:
        """
        Validate and normalize a ProductInput.

        Returns:
            Normalized product dict with:
            - dims_mm: {"L": float, "W": float, "H": float}  [mm]
            - volume_mm3: float  [mm³]
            - weight_kg: float  [kg]
            - fragility_class: str
            - name, category
            - provenance_label: DataLabel
            - assumptions: list[str]
            - errors: list[str] (empty if valid)
            - savings_status: "NOT_CONFIGURED" | "CONFIGURED"

        Raises:
            ProductSpecsValidationError if validation fails.
        """
        errors: list[str] = []
        assumptions: list[str] = [
            "Dimensions are the outer packed dimensions of the product as entered by the user.",
            "Weight is the total packed weight as entered by the user.",
            "Fragility class is user-selected and not independently verified by NxtPak AI.",
            "All dimension conversions use exact factors: mm×1, cm×10, m×1000, inch×25.4.",
        ]

        # ── Dimension conversion ──────────────────────────────────────────────
        try:
            L_mm, W_mm, H_mm = product_input.packed_dimensions.to_mm()
        except Exception as exc:
            errors.append(f"Dimension conversion failed: {exc}")
            L_mm, W_mm, H_mm = 0.0, 0.0, 0.0

        # ── Dimension validation ──────────────────────────────────────────────
        for dim_name, dim_val in [("length", L_mm), ("width", W_mm), ("height", H_mm)]:
            if dim_val <= 0:
                errors.append(f"Dimension '{dim_name}' must be > 0 mm; got {dim_val} mm.")
            elif dim_val > 10000:
                errors.append(
                    f"Dimension '{dim_name}' = {dim_val} mm exceeds 10000 mm limit. Please verify."
                )

        # ── Weight validation ─────────────────────────────────────────────────
        weight_kg = product_input.weight_kg
        if weight_kg <= 0:
            errors.append(f"Weight must be > 0 kg; got {weight_kg} kg.")
        elif weight_kg < 0.001:
            errors.append(f"Weight {weight_kg} kg is implausibly small (< 0.001 kg). Please verify.")
        elif weight_kg > 5000:
            errors.append(f"Weight {weight_kg} kg exceeds 5000 kg limit. Please verify.")

        # ── Fragility class validation ────────────────────────────────────────
        fragility_class = product_input.fragility_class.value
        if fragility_class not in VALID_FRAGILITY_CLASSES:
            errors.append(
                f"fragility_class '{fragility_class}' is not valid. "
                f"Must be one of: {sorted(VALID_FRAGILITY_CLASSES)}"
            )

        if errors:
            logger.warning("ProductSpecsAgent validation failed: %s", errors)
            raise ProductSpecsValidationError(errors)

        # ── Volume calculation ────────────────────────────────────────────────
        volume_mm3 = L_mm * W_mm * H_mm
        assumptions.append(
            f"Product volume calculated as L×W×H = {L_mm}×{W_mm}×{H_mm} mm = {volume_mm3:.2f} mm³. [ESTIMATE]"
        )

        # ── Provenance ───────────────────────────────────────────────────────
        if product_input.provenance:
            prov_raw = getattr(product_input.provenance, "data_label", getattr(product_input.provenance, "source_type", "USER_ENTERED"))
            prov_label = prov_raw.value if hasattr(prov_raw, "value") else str(prov_raw)
            prov_source = product_input.provenance.source_name
        else:
            prov_label = DataLabel.USER_ENTERED.value
            prov_source = "User-entered directly"
            assumptions.append("No provenance object provided; data_label defaulted to USER_ENTERED.")

        # ── Fragility note ────────────────────────────────────────────────────
        if getattr(product_input, "fragility_note", None):
            assumptions.append(f"Fragility note (user-entered): {product_input.fragility_note}")

        result: dict[str, Any] = {
            "name": product_input.name,
            "category": product_input.category,
            "dims_mm": {"L": L_mm, "W": W_mm, "H": H_mm},
            "volume_mm3": volume_mm3,
            "weight_kg": weight_kg,
            "fragility_class": fragility_class,
            "fragility_note": product_input.fragility_note,
            "provenance_label": prov_label,
            "provenance_source": prov_source,
            "components": [c.model_dump() for c in product_input.components],
            "assumptions": assumptions,
            "errors": [],
            # Savings require a baseline — flag if missing
            "savings_status": "NOT_CONFIGURED",
        }

        logger.info(
            "ProductSpecsAgent normalized: name=%r dims_mm=%s vol_mm3=%.2f weight_kg=%.3f fragility=%s",
            result["name"],
            result["dims_mm"],
            result["volume_mm3"],
            result["weight_kg"],
            result["fragility_class"],
        )
        return result

    def normalize_with_baseline(
        self,
        product_input: ProductInput,
        baseline: Optional[Any],
    ) -> dict[str, Any]:
        """
        Normalize product and flag baseline availability for savings calculation.
        """
        result = self.normalize(product_input)
        if baseline is not None:
            result["savings_status"] = "CONFIGURED"
            result["assumptions"].append(
                "Baseline packaging provided; savings calculations will be labeled ESTIMATE — USER_ENTERED baseline."
            )
        else:
            result["savings_status"] = "NOT_CONFIGURED"
            result["assumptions"].append(
                "No baseline provided. Material savings will be labeled NOT_CONFIGURED."
            )
        return result


# Module-level singleton
product_specs_agent = ProductSpecsAgent()
