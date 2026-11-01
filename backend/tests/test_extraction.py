"""
Tests for Free-Text Description Extraction (Deterministic + Hybrid).
Verifies parsing of Tornado blender, stand fan, dimensions, weights, and provenance tagging.
"""

from app.services.extraction_service import deterministic_extract_from_text, merge_extractions


def test_deterministic_blender_extraction():
    text = (
        "Tornado table blender, model BL500/2, 1.5L glass jug, 500W, "
        "net weight 3.2 kg, product dimensions 180 × 165 × 390 mm, carton 220 × 200 × 420 mm."
    )
    data = deterministic_extract_from_text(text)
    assert data.get("brand") == "Tornado"
    assert data.get("model_number") == "BL500/2"
    assert data.get("net_weight_kg") == 3.2
    assert data.get("product_length_mm") == 180.0
    assert data.get("product_width_mm") == 165.0
    assert data.get("product_height_mm") == 390.0
    assert data.get("carton_length_mm") == 220.0
    assert data.get("carton_width_mm") == 200.0
    assert data.get("carton_height_mm") == 420.0
    assert data.get("fragility") == "HIGH"  # glass jug


def test_deterministic_fan_extraction():
    text = (
        "Tornado 16-inch stand fan, model TSF-16W, net weight 7.3 kg, "
        "product dims 460 x 400 x 1400 mm, baseline carton 575 x 310 x 490 mm, BC double wall board."
    )
    data = deterministic_extract_from_text(text)
    assert data.get("brand") == "Tornado"
    assert data.get("model_number") == "TSF-16W"
    assert data.get("net_weight_kg") == 7.3
    assert data.get("product_length_mm") == 460.0
    assert data.get("product_width_mm") == 400.0
    assert data.get("product_height_mm") == 1400.0
    assert data.get("carton_length_mm") == 575.0
    assert data.get("carton_width_mm") == 310.0
    assert data.get("carton_height_mm") == 490.0
    assert data.get("board_type") == "BC Double Wall"


def test_merge_extractions_provenance_labels():
    det = {
        "brand": "Tornado",
        "model_number": "BL500/2",
        "net_weight_kg": 3.2,
        "product_length_mm": 180.0,
        "product_width_mm": 165.0,
        "product_height_mm": 390.0,
    }
    llm = {
        "carton_length_mm": 220.0,
        "carton_width_mm": 200.0,
        "carton_height_mm": 420.0,
    }
    draft = merge_extractions(det, llm)
    # Fields from user text should be labeled FROM_DESCRIPTION
    brand_f = next(f for f in draft.fields if f.field == "brand")
    assert brand_f.provenance == "FROM_DESCRIPTION"

    # Fields filled only by LLM should be labeled AI_ESTIMATED
    carton_l = next(f for f in draft.fields if f.field == "carton_length_mm")
    assert carton_l.provenance == "AI_ESTIMATED"
