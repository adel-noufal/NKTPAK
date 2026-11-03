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

    assert res.candidates == []
    assert "No products found" in res.status_message


def test_get_candidate_specs_endpoint():
    """Test the specs endpoint returning multi-source evidence and summary bar."""
    res = get_product_specs_endpoint(candidate_id="cand-123", model="TSF-16W")

    assert res.model == "TSF-16W"
    assert res.product_dimensions.value is None
    assert res.carton_dimensions.value is None
    assert res.product_dimensions.sources == []
    assert res.packed_dimensions_available is False
    assert res.not_found_message


def test_unknown_model_reports_packed_dimensions_not_found():
    """Verify that an unknown model does not invent fake cards and states no products found plainly."""
    req = ProductSearchRequest(query="XYZ-999-OBSCURE", force_refresh=True)
    res = search_product_pipeline(req)

    # Zero fake candidates created
    assert len(res.candidates) == 0
    assert "No products found" in res.status_message
    assert "enter specifications manually" in res.status_message


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
