"""
Tests for Fetch Service (offline fixtures and deterministic parsing).
Never calls live network in unit tests.
"""

from app.services.fetch_service import fetch_product_data, _normalize_model
from app.schemas.schemas import SourceType


def test_fetch_tsf16w_offline_fixture():
    result = fetch_product_data(model_number="TSF-16W")
    assert result.success is True
    assert result.source_type == SourceType.EL_ARABY_DATASHEET
    assert "otto.de" in (result.source_url or "")

    field_map = {f.field_name: f.value for f in result.fields}
    assert field_map.get("model") == "TSF-16W"
    assert field_map.get("net_weight_kg") == 7.3
    assert field_map.get("carton_outer_length_mm") == 575.0
    assert field_map.get("carton_outer_width_mm") == 310.0
    assert field_map.get("carton_outer_height_mm") == 490.0

    # Ensure unresolved fields explicitly list what must be measured
    assert any("board_thickness" in u.lower() for u in result.unresolved_fields)
    assert any("packed_component" in u.lower() for u in result.unresolved_fields)


def test_fetch_bl500_offline_fixture():
    result = fetch_product_data(model_number="BL500/2")
    assert result.success is True
    assert result.source_type == SourceType.EL_ARABY_WEBSITE
    assert "elarabygroup.com" in (result.source_url or "")

    field_map = {f.field_name: f.value for f in result.fields}
    assert field_map.get("model") == "BL500/2"
    assert field_map.get("power_watts") == 500
    assert field_map.get("net_weight_kg") == 2.6

    # Product and carton dimensions are not on the web page and must be unresolved
    assert any("carton_dimensions" in u.lower() for u in result.unresolved_fields)
    assert any("assembled_dimensions" in u.lower() for u in result.unresolved_fields)


def test_fetch_unknown_model_returns_clear_error():
    result = fetch_product_data(model_number="NONEXISTENT-999")
    assert result.success is False
    assert "not in the offline fixture library" in (result.error or "")


def test_model_normalization():
    assert _normalize_model("tsf-16w") == "TSF16W"
    assert _normalize_model("BL500/2") == "BL5002"
    assert _normalize_model("  tsf - 16 w ") == "TSF16W"
