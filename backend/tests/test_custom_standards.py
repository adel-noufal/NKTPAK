import json
import pytest
from pydantic import ValidationError

from app.api.v1.endpoints.projects import (
    StandardsCatalogEntryInput,
    create_standards_catalog_entry,
    list_notifications,
)
from app.models.models import AppNotification, StandardsCatalogEntry


def valid_entry(**overrides):
    values = {
        "organization": "ISO",
        "standard_identifier": "ISO 00000:2026",
        "title": "Packaging transport test method",
        "scope_summary": "A sufficiently detailed summary for this test standard entry.",
        "what_it_tests": "Transport performance",
        "when_it_applies": "When transport testing is relevant",
        "source_url": "https://www.iso.org/standard/00000.html",
        "version": "2026",
    }
    values.update(overrides)
    return StandardsCatalogEntryInput(**values)


def test_custom_standard_requires_nontrivial_identifier_title_and_scope():
    with pytest.raises(ValidationError):
        valid_entry(standard_identifier=" ")
    with pytest.raises(ValidationError):
        valid_entry(title="abc")
    with pytest.raises(ValidationError):
        valid_entry(scope_summary="too short")


def test_valid_custom_standard_is_saved_as_verified(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.standards_validation_service.validate_standard_entry",
        lambda entry: {"valid": True, "reason": "Grounded match", "mismatches": [], "found": {}, "sources": [{"title": "ISO source", "url": "https://www.iso.org/standard/00000.html"}]},
    )
    result = create_standards_catalog_entry(valid_entry(standard_identifier="ISO TEST 2026"), db_session)
    saved = db_session.query(StandardsCatalogEntry).filter_by(entry_id=result["entry_id"]).one()
    assert result["status"] == "created"
    assert saved.verification_status == "Verified"
    assert saved.is_user_editable is True
    db_session.delete(saved)
    db_session.commit()


def test_refused_custom_standard_persists_unread_notification(db_session, monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(
        "app.services.standards_validation_service.validate_standard_entry",
        lambda entry: {"valid": False, "reason": "Title and identifier do not match the source.", "mismatches": [{"field": "title", "entered": entry["title"], "found": "A different title"}], "found": {"title": "A different title"}, "sources": [{"title": "Publisher result", "url": "https://example.org/standard"}]},
    )
    with pytest.raises(HTTPException) as caught:
        create_standards_catalog_entry(valid_entry(standard_identifier="ISO REFUSED 2026"), db_session)
    assert caught.value.status_code == 422
    assert db_session.query(StandardsCatalogEntry).filter_by(standard_identifier="ISO REFUSED 2026").count() == 0
    notification = db_session.query(AppNotification).one()
    assert notification.is_read is False
    assert "Standard refused: ISO REFUSED 2026" in notification.message
    response = list_notifications(db_session)
    assert response["unread_count"] == 1
    assert response["notifications"][0]["details"]["verification"]["sources"]
    db_session.delete(notification)
    db_session.commit()


@pytest.mark.parametrize(("found_title", "expected_valid"), [("Packaging transport test method", True), ("Unrelated standard title", False)])
def test_grounded_ai_validator_checks_returned_identity_and_title(monkeypatch, found_title, expected_valid):
    from app.services import standards_validation_service as validator

    monkeypatch.setattr(validator, "get_llm_config", lambda: {"provider": "gemini", "api_key": "test-key", "model": "gemini-2.5-flash"})
    answer = {
        "valid": True,
        "reason": "Grounded publisher match.",
        "mismatches": [],
        "found": {"identifier": "ISO 00000:2026", "organization": "ISO", "title": found_title, "version": "2026", "source_url": "https://www.iso.org/standard/00000.html"},
    }
    response_body = {
        "candidates": [{
            "content": {"parts": [{"text": json.dumps(answer)}]},
            "groundingMetadata": {"groundingChunks": [{"web": {"title": "ISO publisher page", "uri": "https://www.iso.org/standard/00000.html"}}]},
        }]
    }

    class FakeResponse:
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def read(self): return json.dumps(response_body).encode("utf-8")

    monkeypatch.setattr(validator.urllib.request, "urlopen", lambda *args, **kwargs: FakeResponse())
    result = validator.validate_standard_entry({
        "organization": "ISO", "standard_identifier": "ISO 00000:2026", "title": "Packaging transport test method",
        "version": "2026", "source_url": "https://www.iso.org/standard/00000.html",
    })
    assert result["valid"] is expected_valid
    if not expected_valid:
        assert any(item["field"] == "title" for item in result["mismatches"])
