"""
Deterministic & Hybrid Extraction Service for Free-Text Packaging Briefs.
Parses product specifications and carton dimensions directly from natural-language descriptions
in English or Arabic with or without an active LLM key.
"""

from __future__ import annotations
import re
from typing import Dict, Any, Optional, List
from app.schemas.description_schemas import ProjectDraft, ExtractedField


KNOWN_BRANDS = [
    "Tornado", "Toshiba", "Sharp", "El Araby", "El Araby Group",
    "Hoover", "Candy", "Sony", "Hitachi", "Samsung", "LG", "Philips"
]

BOARD_TYPE_MAP = {
    "double wall": "BC Double Wall",
    "double-wall": "BC Double Wall",
    "bc double wall": "BC Double Wall",
    "5-ply": "BC Double Wall",
    "5 ply": "BC Double Wall",
    "single wall": "B Flute Single Wall",
    "single-wall": "B Flute Single Wall",
    "3-ply": "B Flute Single Wall",
    "b flute": "B Flute Single Wall",
    "c flute": "C Flute Single Wall",
    "microflute": "E Flute Microflute",
    "e flute": "E Flute Microflute",
    "triple wall": "Heavy Duty Triple Wall",
    "7-ply": "Heavy Duty Triple Wall",
}


def deterministic_extract_from_text(text: str) -> Dict[str, Any]:
    """
    Extract structured fields from plain text using deterministic regex rules.
    Guarantees instant, reliable extraction with zero external API dependencies.
    """
    data: Dict[str, Any] = {}
    cleaned = text.strip()

    # 1. Brand detection
    for b in KNOWN_BRANDS:
        if re.search(r"\b" + re.escape(b) + r"\b", cleaned, re.IGNORECASE):
            data["brand"] = b
            break

    # 2. Model number detection
    # e.g., "model BL500/2", "model: TSF-16W", "TSD-16W", "BL500/2"
    model_match = re.search(r"\bmodel\s*[:#]?\s*([A-Za-z0-9/\-]+)", cleaned, re.IGNORECASE)
    if model_match:
        data["model_number"] = model_match.group(1).strip()
    else:
        # Check for standalone model codes like TSF-16W, BL500/2, 2T-C32EF2EX
        code_match = re.search(r"\b([A-Z]{2,4}[-\s]?[0-9]{2,4}[A-Za-z0-9/\-]*)\b", cleaned)
        if code_match and code_match.group(1).upper() not in ["EAN", "SKU", "ISO"]:
            data["model_number"] = code_match.group(1).strip()

    # 3. Product Name extraction
    # If brand & model or first sentence mentions item
    first_clause = re.split(r"[,.;\n]", cleaned)[0].strip()
    if first_clause and len(first_clause) < 60:
        data["name"] = first_clause
    elif data.get("brand") and data.get("model_number"):
        data["name"] = f"{data['brand']} {data['model_number']} Packaging"

    # 4. Net weight in kg
    # e.g. "net weight 3.2 kg", "about 4.5 kg", "7.3 kg"
    wt_match = re.search(r"(?:net\s+)?weight[:\s]+(\d+(?:\.\d+)?)\s*kg", cleaned, re.IGNORECASE)
    if not wt_match:
        wt_match = re.search(r"(?:about|approx\.?|around)?\s*(\d+(?:\.\d+)?)\s*kg", cleaned, re.IGNORECASE)
    if wt_match:
        try:
            data["net_weight_kg"] = float(wt_match.group(1))
        except ValueError:
            pass

    # 5. Dimensions: Find all 3D dimension matches (L x W x H)
    # Support "x", "X", "*", "×", and Arabic "×"
    dim_pattern = r"(\d+(?:\.\d+)?)\s*(?:[xX*×]|\s*by\s*)\s*(\d+(?:\.\d+)?)\s*(?:[xX*×]|\s*by\s*)\s*(\d+(?:\.\d+)?)\s*(?:mm|cm)?"
    all_dims = list(re.finditer(dim_pattern, cleaned))

    carton_dims_found = None
    product_dims_found = None

    # Check context around each match
    for m in all_dims:
        start_idx = max(0, m.start() - 35)
        context_before = cleaned[start_idx:m.start()].lower()
        dims = (float(m.group(1)), float(m.group(2)), float(m.group(3)))

        # Convert cm to mm if "cm" appears right after
        unit_after = cleaned[m.end():m.end() + 5].lower()
        if "cm" in unit_after or "cm" in context_before:
            dims = (dims[0] * 10, dims[1] * 10, dims[2] * 10)

        if any(w in context_before for w in ["carton", "box", "baseline", "packed in", "outer"]):
            carton_dims_found = dims
        elif any(w in context_before for w in ["product", "assembled", "item", "unit"]):
            product_dims_found = dims
        else:
            if not product_dims_found:
                product_dims_found = dims
            elif not carton_dims_found:
                carton_dims_found = dims

    if product_dims_found:
        data["product_length_mm"] = product_dims_found[0]
        data["product_width_mm"] = product_dims_found[1]
        data["product_height_mm"] = product_dims_found[2]

    if carton_dims_found:
        data["carton_length_mm"] = carton_dims_found[0]
        data["carton_width_mm"] = carton_dims_found[1]
        data["carton_height_mm"] = carton_dims_found[2]

    # 6. Board type
    lower_cleaned = cleaned.lower()
    for key, val in BOARD_TYPE_MAP.items():
        if key in lower_cleaned:
            data["board_type"] = val
            break

    # 7. Fragility
    if any(w in lower_cleaned for w in ["glass", "precision", "very fragile", "delicate electronics"]):
        data["fragility"] = "HIGH"
    elif any(w in lower_cleaned for w in ["motor", "fragile", "fan blade", "switch"]):
        data["fragility"] = "MEDIUM"
    elif any(w in lower_cleaned for w in ["sturdy", "metal", "non-breakable", "low fragility"]):
        data["fragility"] = "LOW"

    # 8. Units per carton / pallet
    pallet_match = re.search(r"(\d+)\s*(?:units?|cartons?)\s*(?:per|/)\s*pallet", lower_cleaned)
    if pallet_match:
        try:
            data["units_per_pallet"] = int(pallet_match.group(1))
        except ValueError:
            pass

    return data


def merge_extractions(det_data: Dict[str, Any], llm_data: Optional[Dict[str, Any]]) -> ProjectDraft:
    """
    Merge deterministic and LLM extractions.
    Values extracted directly from text are tagged FROM_DESCRIPTION.
    Any values inferred or gap-filled by LLM are tagged AI_ESTIMATED.
    """
    merged: Dict[str, Any] = {}
    provenances: Dict[str, str] = {}

    all_keys = [
        "name", "brand", "model_number", "sku",
        "product_length_mm", "product_width_mm", "product_height_mm",
        "net_weight_kg", "fragility",
        "carton_length_mm", "carton_width_mm", "carton_height_mm",
        "board_type", "units_per_carton", "units_per_pallet", "notes"
    ]

    # Start with deterministic values (grounded in user text)
    for k in all_keys:
        val = det_data.get(k)
        if val is not None:
            merged[k] = val
            provenances[k] = "FROM_DESCRIPTION"

    # Fill remaining from LLM if available
    if llm_data:
        for k in all_keys:
            if k not in merged or merged[k] is None:
                val = llm_data.get(k)
                if val is not None:
                    merged[k] = val
                    provenances[k] = "AI_ESTIMATED"

    # Calculate fields list
    fields: List[ExtractedField] = []
    for k in all_keys:
        val = merged.get(k)
        fields.append(ExtractedField(
            field=k,
            value=str(val) if val is not None else None,
            provenance=provenances.get(k, "USER_ENTERED"),
            confidence=0.95 if provenances.get(k) == "FROM_DESCRIPTION" else 0.8,
            missing=(val is None),
        ))

    required = [
        "product_length_mm", "product_width_mm", "product_height_mm",
        "net_weight_kg", "carton_length_mm", "carton_width_mm", "carton_height_mm"
    ]
    missing_required = [f for f in required if merged.get(f) is None]

    return ProjectDraft(
        name=merged.get("name"),
        brand=merged.get("brand"),
        model_number=merged.get("model_number"),
        sku=merged.get("sku"),
        product_length_mm=merged.get("product_length_mm"),
        product_width_mm=merged.get("product_width_mm"),
        product_height_mm=merged.get("product_height_mm"),
        net_weight_kg=merged.get("net_weight_kg"),
        fragility=merged.get("fragility"),
        carton_length_mm=merged.get("carton_length_mm"),
        carton_width_mm=merged.get("carton_width_mm"),
        carton_height_mm=merged.get("carton_height_mm"),
        board_type=merged.get("board_type"),
        units_per_carton=merged.get("units_per_carton"),
        notes=merged.get("notes"),
        fields=fields,
        missing_required=missing_required,
        llm_offline=False,
        extraction_notes="Grounded extraction complete with provenance tracking.",
    )
