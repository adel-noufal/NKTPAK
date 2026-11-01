"""
Tests for Dynamic Product Search & Fetch Pipeline.
Tests query normalization, SSRF protection, fuzzy typo matching ('Did you mean?'),
and candidate generation without external network calls.
"""

from app.services.fetch_service import (
    search_product_pipeline,
    normalize_query_string,
    levenshtein_distance,
    is_ssrf_safe_url,
)
from app.schemas.schemas import ProductSearchRequest, SourceType


def test_query_normalization():
    assert normalize_query_string("tsf-16w") == "TSF16W"
    assert normalize_query_string("  tsf - 16 w ") == "TSF16W"
    assert normalize_query_string("BL500/2") == "BL5002"
    assert normalize_query_string("bl-500/2") == "BL5002"


def test_ssrf_protection():
    assert is_ssrf_safe_url("http://127.0.0.1/admin") is False
    assert is_ssrf_safe_url("http://localhost:8000/api") is False
    assert is_ssrf_safe_url("http://192.168.1.1/") is False
    assert is_ssrf_safe_url("http://10.0.0.1/secret") is False
    assert is_ssrf_safe_url("ftp://example.com/file") is False


def test_levenshtein_distance():
    assert levenshtein_distance("TSD16W", "TSF16W") == 1
    assert levenshtein_distance("FAN", "FAN") == 0
    assert levenshtein_distance("BL500", "BL5002") == 1


def test_search_typo_correction_tsd_16w():
    """Typing 'tsd-16w' triggers typo correction suggesting 'TSF-16W'."""
    req = ProductSearchRequest(query="tsd-16w")
    res = search_product_pipeline(req)
    assert res.did_you_mean == "TSF-16W"
    assert len(res.candidates) >= 1
    cand = res.candidates[0]
    assert cand.model == "TSF-16W"
    assert cand.brand == "Tornado"


def test_search_exact_match_bl500():
    req = ProductSearchRequest(query="BL500/2")
    res = search_product_pipeline(req)
    assert len(res.candidates) >= 1
    cand = res.candidates[0]
    assert "BL500/2" in cand.model
    assert cand.brand == "Tornado"


def test_search_unknown_query_creates_structured_candidate():
    """Verify that unknown queries return zero fake candidates and honest diagnostics."""
    req = ProductSearchRequest(query="CUSTOM-FAN-99", brand="Tornado")
    res = search_product_pipeline(req)
    assert len(res.candidates) == 0
    assert "No products found" in res.status_message
    assert "enter specifications manually" in res.status_message
