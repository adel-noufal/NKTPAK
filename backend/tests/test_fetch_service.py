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
    assert res.did_you_mean is None
    assert res.candidates == []


def test_search_exact_match_bl500():
    req = ProductSearchRequest(query="BL500/2")
    res = search_product_pipeline(req)
    assert res.candidates == []
    assert "No products found" in res.status_message


def test_search_unknown_query_creates_structured_candidate():
    """Verify that unknown queries return zero fake candidates and honest diagnostics."""
    req = ProductSearchRequest(query="CUSTOM-FAN-99", brand="Tornado")
    res = search_product_pipeline(req)
    assert len(res.candidates) == 0
    assert "No products found" in res.status_message
    assert "enter specifications manually" in res.status_message
def test_fabricated_source_labels_are_absent_from_runtime_code():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    labels = (
        "El Araby Engineering Datasheet (PDF)",
        "Noon Egypt B2B Logistics",
        "Amazon Egypt Logistics",
        "Jumia Egypt Official Flagship",
    )
    code_files = list((root / "backend" / "app").rglob("*.py")) + list((root / "frontend" / "src").rglob("*.ts")) + list((root / "frontend" / "src").rglob("*.tsx"))
    contents = "\n".join(path.read_text(encoding="utf-8") for path in code_files)
    for label in labels:
        assert label not in contents


def test_grounded_search_candidates_use_only_relevant_grounding_pages(monkeypatch):
    import json
    from unittest.mock import MagicMock
    from app.services import fetch_service, assistant_service

    monkeypatch.undo()
    monkeypatch.setattr(assistant_service, "get_llm_config", lambda: {"provider": "gemini", "api_key": "test-key", "model": "gemini-2.5-flash"})
    payload = {"candidates": [{"groundingMetadata": {"groundingChunks": [
        {"web": {"title": "Tornado 16 inch Stand Fan TSF-16W", "uri": "https://www.elarabygroup.com/product/tsf-16w"}},
        {"web": {"title": "tornadoblender.com", "uri": "https://tornadoblender.com"}},
    ]}}]}
    response = MagicMock()
    response.__enter__.return_value.read.return_value = json.dumps(payload).encode()
    monkeypatch.setattr(fetch_service.urllib.request, "urlopen", lambda *args, **kwargs: response)

    candidates, diagnostic = fetch_service._gemini_grounded_product_search("stand fan")
    assert len(candidates) == 1
    assert candidates[0].model == "TSF-16W"
    assert candidates[0].dimensions_mm is None
    assert candidates[0].provenance.source_url == "https://www.elarabygroup.com/product/tsf-16w"
    assert diagnostic["status"] == "success"
