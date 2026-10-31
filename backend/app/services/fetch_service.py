"""
NxtPak AI — Fetch Service
Parses product data from El Araby datasheet (offline fixture) or live URL.
Never invents numeric values. Missing values are returned as unresolved_fields.
"""

from __future__ import annotations

import os
import logging
from datetime import date
from typing import Optional

from app.schemas.schemas import (
    FetchProductResult,
    FetchedFieldValue,
    SourceType,
)

logger = logging.getLogger(__name__)

TODAY = date.today().isoformat()


# ─────────────────────────────────────────────
# Offline fixtures (real data from datasheets / El Araby website)
# These are used when the user provides a known model number,
# so the app works without network access.
# ─────────────────────────────────────────────

_OFFLINE_FIXTURES: dict[str, FetchProductResult] = {}


def _build_tsf16w_fixture() -> FetchProductResult:
    """
    Real data for Tornado Stand Fan TSF-16W.
    Source: El Araby Germany GmbH datasheet
    https://d.otto.de/files/63751d29-94cc-4425-8250-d7468ff8c95c.pdf
    Retrieved: 2026-10-31
    """
    source_url = "https://d.otto.de/files/63751d29-94cc-4425-8250-d7468ff8c95c.pdf"
    source_type = SourceType.EL_ARABY_DATASHEET
    retrieval_date = "2026-10-31"

    fields = [
        FetchedFieldValue(
            field_name="product_name",
            value="Tornado Stand Fan TSF-16W",
            unit=None,
            source_url=source_url,
            evidence_snippet="Product: Tornado Stand Fan, Model TSF-16W, 16 inch, 4 blades, black",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="brand",
            value="Tornado / El Araby",
            unit=None,
            source_url=source_url,
            evidence_snippet="El Araby Germany GmbH product datasheet",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="model",
            value="TSF-16W",
            unit=None,
            source_url=source_url,
            evidence_snippet="Model number: TSF-16W",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="ean",
            value="6221127018394",
            unit=None,
            source_url=source_url,
            evidence_snippet="EAN: 6221127018394",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="assembled_length_mm",
            value=460.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Assembled fan dimensions: 460 mm (L) × 400 mm (W) × 1400 mm (H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="assembled_width_mm",
            value=400.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Assembled fan dimensions: 460 mm (L) × 400 mm (W) × 1400 mm (H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="assembled_height_mm",
            value=1400.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Assembled fan dimensions: 460 mm (L) × 400 mm (W) × 1400 mm (H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="net_weight_kg",
            value=7.3,
            unit="kg",
            source_url=source_url,
            evidence_snippet="Net weight: 7.3 kg",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="gross_weight_kg",
            value=9.1,
            unit="kg",
            source_url=source_url,
            evidence_snippet="Gross weight (product + packaging): 9.1 kg",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="packaging_mass_kg",
            value=1.8,
            unit="kg",
            source_url=source_url,
            evidence_snippet="DERIVED: gross_weight (9.1) − net_weight (7.3) = 1.8 kg",
            source_type=SourceType.DERIVED,
            retrieval_date=retrieval_date,
        ),
        # Baseline carton — external, from datasheet
        FetchedFieldValue(
            field_name="carton_outer_length_mm",
            value=575.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Current carton (BASELINE), external: 575 × 310 × 490 mm (L × W × H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="carton_outer_width_mm",
            value=310.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Current carton (BASELINE), external: 575 × 310 × 490 mm (L × W × H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="carton_outer_height_mm",
            value=490.0,
            unit="mm",
            source_url=source_url,
            evidence_snippet="Current carton (BASELINE), external: 575 × 310 × 490 mm (L × W × H)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="carton_volume_cm3",
            value=87342.5,
            unit="cm³",
            source_url=source_url,
            evidence_snippet="DERIVED: 57.5 × 31 × 49 = 87,342.5 cm³ (carton external volume)",
            source_type=SourceType.DERIVED,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="units_per_40ft_container",
            value=760,
            unit="units",
            source_url=source_url,
            evidence_snippet="760 units per 40-foot HQ container (as stated in datasheet)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="power_watts",
            value=60,
            unit="W",
            source_url=source_url,
            evidence_snippet="60 ±3 W",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="voltage",
            value="220 V AC 50 Hz",
            unit=None,
            source_url=source_url,
            evidence_snippet="220 V AC 50 Hz",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="blade_count",
            value=4,
            unit=None,
            source_url=source_url,
            evidence_snippet="4 plastic blades",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="datasheet_note_blade_diameter",
            value=(
                "Datasheet writes blade diameter as '16 inch (40 mm)'. "
                "This appears to be a typo — 16 inch ≈ 406 mm, not 40 mm. "
                "Do not use 40 mm as a diameter."
            ),
            unit=None,
            source_url=source_url,
            evidence_snippet="16 inch (40 mm) — likely typo for 40 cm",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="datasheet_note_volume",
            value=(
                "Datasheet lists 'Volume 257600 cm³' which equals 46 × 40 × 140 cm "
                "(assembled fan envelope), NOT the carton volume."
            ),
            unit=None,
            source_url=source_url,
            evidence_snippet="Volume 257600 cm³ = 46 × 40 × 140 cm (assembled dimensions)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
    ]

    unresolved_fields = [
        "carton_board_thickness_mm — NOT in datasheet; must be measured",
        "carton_board_type — NOT in datasheet; must be measured",
        "insert_material — NOT in datasheet; must be measured",
        "insert_dimensions — NOT in datasheet; must be measured",
        "packed_component_dimensions — fan ships disassembled; measure each packed part",
        "packed_component_weights — NOT in datasheet; measure each packed part",
        "carton_cost_per_unit — NOT publicly available",
        "insert_cost_per_unit — NOT publicly available",
    ]

    return FetchProductResult(
        success=True,
        source_url=source_url,
        source_type=SourceType.EL_ARABY_DATASHEET,
        retrieved_at=retrieval_date,
        fields=fields,
        unresolved_fields=unresolved_fields,
        warning=(
            "Fan ships DISASSEMBLED. The assembled envelope (460×400×1400 mm) is for reference only. "
            "Board thickness, insert dimensions, and packed-part dimensions are NOT in the datasheet — "
            "they must be measured on site."
        ),
    )


def _build_bl500_2_fixture() -> FetchProductResult:
    """
    Real data for Tornado Electric Blender BL500/2.
    Source: El Araby product page
    https://www.elarabygroup.com/en/tornado-electric-blender-500-watt-1-5-liter-2-mills-black-bl500-2-black
    Retrieved: 2026-10-31
    """
    source_url = (
        "https://www.elarabygroup.com/en/"
        "tornado-electric-blender-500-watt-1-5-liter-2-mills-black-bl500-2-black"
    )
    source_type = SourceType.EL_ARABY_WEBSITE
    retrieval_date = "2026-10-31"

    fields = [
        FetchedFieldValue(
            field_name="product_name",
            value="Tornado Electric Blender BL500/2",
            unit=None,
            source_url=source_url,
            evidence_snippet=(
                "Tornado Electric Blender, 500 Watt, 1.5 Liter, 2 Mills, Black — BL500/2-BLACK"
            ),
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="brand",
            value="Tornado / El Araby",
            unit=None,
            source_url=source_url,
            evidence_snippet="El Araby Group product page",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="model",
            value="BL500/2",
            unit=None,
            source_url=source_url,
            evidence_snippet="Model: BL500/2 (colour variants: BL500/2-BLACK, BL500/2-GRAY, BL500/2-DBLUE)",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="power_watts",
            value=500,
            unit="W",
            source_url=source_url,
            evidence_snippet="500 Watt",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="jug_capacity_liters",
            value=1.5,
            unit="L",
            source_url=source_url,
            evidence_snippet="1.5 Liter",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="voltage",
            value="220 V",
            unit=None,
            source_url=source_url,
            evidence_snippet="220V",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="mill_count",
            value=2,
            unit=None,
            source_url=source_url,
            evidence_snippet="2 Mills",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="net_weight_kg",
            value=2.6,
            unit="kg",
            source_url=source_url,
            evidence_snippet="Net weight: 2.6 kg",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="gross_weight_kg",
            value=2.8,
            unit="kg",
            source_url=source_url,
            evidence_snippet="Gross weight: 2.8 kg",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="packaging_mass_kg",
            value=0.2,
            unit="kg",
            source_url=source_url,
            evidence_snippet="DERIVED: gross_weight (2.8) − net_weight (2.6) = 0.2 kg",
            source_type=SourceType.DERIVED,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="piece_count",
            value=4,
            unit=None,
            source_url=source_url,
            evidence_snippet=(
                "4 pieces (to be confirmed by user): motor base, 1.5 L jug, mill 1, mill 2"
            ),
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="jug_material",
            value="Transparent break-resistant plastic",
            unit=None,
            source_url=source_url,
            evidence_snippet="transparent break-resistant plastic jug",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="blade_material",
            value="Stainless steel",
            unit=None,
            source_url=source_url,
            evidence_snippet="stainless-steel blades",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="country_of_manufacture",
            value="Egypt",
            unit=None,
            source_url=source_url,
            evidence_snippet="made in Egypt",
            source_type=source_type,
            retrieval_date=retrieval_date,
        ),
        FetchedFieldValue(
            field_name="amazon_unverified_note",
            value=(
                "UNVERIFIED LEAD (stored as note only — do NOT use as baseline unless confirmed): "
                "Amazon Egypt listed a package listed as ~35.6 × 33 × 21.8 cm. "
                "Source may refer to product or carton; not confirmed."
            ),
            unit=None,
            source_url=source_url,
            evidence_snippet="Amazon Egypt listing — unverified; may be product or carton size",
            source_type=SourceType.PUBLIC_RETAIL,
            retrieval_date=retrieval_date,
        ),
    ]

    unresolved_fields = [
        "assembled_dimensions_mm — NOT on product page; must be measured",
        "per_piece_dimensions_mm — NOT on product page; must be measured (motor base, jug, mill 1, mill 2)",
        "per_piece_weights_kg — NOT on product page; must be measured",
        "carton_dimensions_mm — NOT on product page; must be measured",
        "carton_board_thickness_mm — NOT on product page; must be measured",
        "carton_board_type — NOT on product page; must be measured",
        "insert_material — NOT on product page; must be measured",
        "insert_dimensions — NOT on product page; must be measured",
        "carton_cost_per_unit — NOT publicly available",
        "insert_cost_per_unit — NOT publicly available",
    ]

    return FetchProductResult(
        success=True,
        source_url=source_url,
        source_type=SourceType.EL_ARABY_WEBSITE,
        retrieved_at=retrieval_date,
        fields=fields,
        unresolved_fields=unresolved_fields,
        warning=(
            "Product dimensions (assembled and per-piece) are NOT available on the El Araby product page. "
            "Carton dimensions are also NOT available. All dimensional fields must be measured on site. "
            "The Amazon listing (~35.6×33×21.8 cm) is unverified — stored as a note only."
        ),
    )


# Register offline fixtures
_OFFLINE_FIXTURES["TSF-16W"] = _build_tsf16w_fixture()
_OFFLINE_FIXTURES["TSF16W"] = _OFFLINE_FIXTURES["TSF-16W"]
_OFFLINE_FIXTURES["BL500/2"] = _build_bl500_2_fixture()
_OFFLINE_FIXTURES["BL500-2"] = _OFFLINE_FIXTURES["BL500/2"]
_OFFLINE_FIXTURES["BL5002"] = _OFFLINE_FIXTURES["BL500/2"]


def _normalize_model(model: str) -> str:
    """Normalise model number for fixture lookup (uppercase, strip spaces/dashes)."""
    return model.upper().replace(" ", "").replace("-", "").replace("/", "").strip()


def _lookup_fixture(model_number: Optional[str], product_url: Optional[str]) -> Optional[FetchProductResult]:
    """Check if a known offline fixture matches the request."""
    if model_number:
        # Try exact, then normalised
        if model_number in _OFFLINE_FIXTURES:
            return _OFFLINE_FIXTURES[model_number]
        key_norm = _normalize_model(model_number)
        for fixture_key, fixture in _OFFLINE_FIXTURES.items():
            if _normalize_model(fixture_key) == key_norm:
                return fixture

    if product_url:
        url_lower = product_url.lower()
        if "tsf" in url_lower and "16" in url_lower:
            return _OFFLINE_FIXTURES["TSF-16W"]
        if "bl500" in url_lower or "bl-500" in url_lower:
            return _OFFLINE_FIXTURES["BL500/2"]

    return None


def fetch_product_data(
    model_number: Optional[str] = None,
    product_url: Optional[str] = None,
) -> FetchProductResult:
    """
    Fetch and parse product data from El Araby datasheet or website.

    Strategy:
    1. Check offline fixtures first (known El Araby products). Works without network.
    2. Optionally try live HTTP fetch if fixture not found (sandbox/network must be available).
    3. Return structured FetchProductResult with provenance on every field.

    Never invents numeric values. All unknown fields appear in unresolved_fields.
    """
    # 1. Offline fixture lookup (always works, no network needed)
    fixture = _lookup_fixture(model_number, product_url)
    if fixture is not None:
        logger.info("Fetch service: returning offline fixture for model=%s url=%s", model_number, product_url)
        return fixture

    # 2. Attempt live fetch if URL is provided
    if product_url:
        logger.info("Fetch service: no fixture found, attempting live fetch for %s", product_url)
        live_result = _try_live_fetch(product_url)
        if live_result is not None:
            return live_result

    # 3. Could not resolve
    what = model_number or product_url or "unknown"
    return FetchProductResult(
        success=False,
        error=(
            f"Product '{what}' is not in the offline fixture library and could not be fetched live. "
            "Supported model numbers: TSF-16W, BL500/2. "
            "For other products, enter values manually."
        ),
        unresolved_fields=[
            "All fields — product not found in offline library; enter values manually"
        ],
    )


def _try_live_fetch(url: str) -> Optional[FetchProductResult]:
    """
    Attempt to parse JSON-LD/schema.org or spec tables from a live URL.
    Returns None if the site is unreachable, robots-disallowed, or parseable data not found.
    Only HTTP(S) URLs are attempted. Never makes up values.
    """
    try:
        import urllib.request
        import json
        import re

        # Only allow HTTP/HTTPS
        if not url.startswith(("http://", "https://")):
            return None

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "NxtPak-AI/1.0 (NXTPAK Hackathon packaging optimizer; "
                    "contact: nxtpak-team@example.com)"
                )
            },
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status != 200:
                return None
            html = response.read().decode("utf-8", errors="replace")

        fields: list[FetchedFieldValue] = []
        retrieval_date = TODAY

        # Try JSON-LD schema.org Product
        ld_matches = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html,
            re.DOTALL | re.IGNORECASE,
        )
        for ld_raw in ld_matches:
            try:
                obj = json.loads(ld_raw.strip())
                if not isinstance(obj, dict):
                    continue
                if obj.get("@type") not in ("Product", "product"):
                    continue

                name = obj.get("name")
                if name:
                    fields.append(FetchedFieldValue(
                        field_name="product_name",
                        value=str(name),
                        source_url=url,
                        evidence_snippet=f'JSON-LD schema.org Product name: "{name}"',
                        source_type=SourceType.EL_ARABY_WEBSITE,
                        retrieval_date=retrieval_date,
                    ))

                brand = obj.get("brand", {})
                brand_name = brand.get("name") if isinstance(brand, dict) else str(brand)
                if brand_name:
                    fields.append(FetchedFieldValue(
                        field_name="brand",
                        value=str(brand_name),
                        source_url=url,
                        evidence_snippet=f'JSON-LD brand: "{brand_name}"',
                        source_type=SourceType.EL_ARABY_WEBSITE,
                        retrieval_date=retrieval_date,
                    ))

                # Parse additionalProperty / weight
                weight = obj.get("weight") or obj.get("netWeight")
                if weight:
                    fields.append(FetchedFieldValue(
                        field_name="net_weight_raw",
                        value=str(weight),
                        source_url=url,
                        evidence_snippet=f'JSON-LD weight: "{weight}"',
                        source_type=SourceType.EL_ARABY_WEBSITE,
                        retrieval_date=retrieval_date,
                    ))

            except (json.JSONDecodeError, ValueError):
                continue

        if fields:
            return FetchProductResult(
                success=True,
                source_url=url,
                source_type=SourceType.EL_ARABY_WEBSITE,
                retrieved_at=retrieval_date,
                fields=fields,
                unresolved_fields=[
                    "Most fields — live page parsed only partial data from JSON-LD; "
                    "enter remaining values manually"
                ],
                warning=(
                    "Data parsed from live webpage JSON-LD. "
                    "Verify each field before use. "
                    "Numeric packaging dimensions were not found and must be entered manually."
                ),
            )

        # Nothing parseable found
        return FetchProductResult(
            success=False,
            error=(
                f"Could not extract structured product data from {url}. "
                "The page may not contain JSON-LD schema.org markup. "
                "Enter values manually."
            ),
            source_url=url,
            unresolved_fields=["All fields — page structure not parseable"],
        )

    except OSError as exc:
        logger.warning("Live fetch failed for %s: %s", url, exc)
        return FetchProductResult(
            success=False,
            error=(
                f"Site unreachable ({exc}). "
                "Check your network connection or enter values manually."
            ),
            source_url=url,
            unresolved_fields=["All fields — site unreachable"],
        )
    except Exception as exc:
        logger.warning("Live fetch error for %s: %s", url, exc)
        return None
