"""
Tests for Multi-Source Fetch, Cross-Checked Specs, Arabic Label Parsing, and Evidence Drawer.
"""

import pytest
from app.api.v1.endpoints.projects import (
    fetch_product_endpoint,
    get_product_specs_endpoint,
    estimate_dimensions_endpoint,
)
from app.services.fetch_service import (
    normalize_arabic_digits,
    extract_specs_from_html,
    search_product_pipeline,
    get_candidate_specs_by_id,
    estimate_dimensions_with_ai,
)
from app.schemas.schemas import ProductSearchRequest


def test_fetch_tsf16w_returns_physical_dimensions_and_components():
    """Verify that searching TSF-16W extracts true physical dimensions, carton size, and components."""
    req = ProductSearchRequest(query="tsf-16w", force_refresh=True)
    res = search_product_pipeline(req)

    assert len(res.candidates) >= 1
    cand = res.candidates[0]

    assert cand.brand == "Tornado"
    assert cand.model == "TSF-16W"
    # True assembled product dimensions (mm)
    assert cand.dimensions_mm == {"length": 460.0, "width": 460.0, "height": 1250.0}
    # True carton packed dimensions (mm)
    assert cand.carton_dimensions_mm == {"length": 555.0, "width": 255.0, "height": 454.0}
    # Net and gross weights
    assert cand.net_weight_kg == 6.5
    assert cand.gross_weight_kg == 7.8
    # Components breakdown (shipped disassembled)
    assert len(cand.components) == 6
    part_names = [c.name for c in cand.components]
    assert any("Base" in n for n in part_names)
    assert any("Pole" in n for n in part_names)
    assert any("Motor" in n for n in part_names)
    assert any("Guard" in n for n in part_names)
    assert any("Blades" in n for n in part_names)
    # Packed dimensions are available
    assert cand.packed_dimensions_available is True
    # Provenance carries official catalog source
    assert "El Araby" in cand.provenance.source_name


def test_get_candidate_specs_endpoint():
    """Test the specs endpoint returning multi-source evidence and summary bar."""
    res = get_product_specs_endpoint(candidate_id="cand-123", model="TSF-16W")

    assert res.model == "TSF-16W"
    assert res.product_dimensions.value["length"] == 460.0
    assert res.carton_dimensions.value["length"] == 555.0
    assert res.product_dimensions.status.value == "verified"
    assert len(res.product_dimensions.sources) >= 2
    assert "summary_bar" in res.model_dump()
    assert "11 of 16 filled" in res.summary_bar["text"]


def test_unknown_model_reports_packed_dimensions_not_found():
    """Verify that an unknown model does not invent numbers and states packed dimensions not found."""
    req = ProductSearchRequest(query="XYZ-999-OBSCURE", force_refresh=True)
    res = search_product_pipeline(req)

    assert len(res.candidates) >= 1
    cand = res.candidates[0]
    assert cand.dimensions_mm is None
    assert cand.carton_dimensions_mm is None
    assert cand.packed_dimensions_available is False
    assert "No public source lists the packed dimensions" in (cand.not_found_message or "")


def test_arabic_indic_digit_and_label_parsing():
    """Verify normalization and parsing of Arabic HTML with Arabic-Indic digits."""
    arabic_html = """
    <html>
      <body>
        <h1>مروحة تورنيدو ستاند</h1>
        <table>
          <tr><td>الأبعاد</td><td>٤٦٠ × ٤٦٠ × ١٢٥٠ مم</td></tr>
          <tr><td>أبعاد الكرتونة</td><td>٥٥٥ × ٢٥٥ × ٤٥٤ مم</td></tr>
          <tr><td>الوزن الصافي</td><td>٦.٥ كجم</td></tr>
        </table>
      </body>
    </html>
    """
    specs = extract_specs_from_html(arabic_html, "https://elarabygroup.com/ar/fan")
    assert specs["dimensions_mm"] == {"length": 460.0, "width": 460.0, "height": 1250.0}
    assert specs["carton_dimensions_mm"] == {"length": 555.0, "width": 255.0, "height": 454.0}
    assert specs["weight_kg"] == 6.5


def test_estimate_dimensions_endpoint_returns_low_confidence_ai_estimate():
    """Verify AI dimension estimate returns low confidence amber badge and comparison links."""
    data = estimate_dimensions_endpoint({"query": "Tornado Custom Fan", "category": "Fans"})

    assert data["status"] == "ai_estimated"
    assert data["is_low_confidence"] is True
    assert data["confidence"] < 0.50
    assert "Low confidence" in data["badge"]
    assert "Cannot be used for final optimization until confirmed" in data["warning"]
    assert len(data["comparison_products"]) >= 1
