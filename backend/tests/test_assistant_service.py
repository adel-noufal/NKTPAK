"""
Tests for Assistant Service (Production: real tool calling, honest unconfigured state, zero canned fake answers).
All tests mock the DB and LLM network calls so no real API key or network is required.
"""

from unittest.mock import patch
from app.services.assistant_service import (
    get_assistant_reply,
    tool_calculate_mckee,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_llm_config_no_key():
    """Return a config with an empty API key (unconfigured state)."""
    return {"provider": "gemini", "api_key": "", "model": "gemini-1.5-flash"}


def _mock_llm_config_with_key():
    """Return a config with a dummy Anthropic key (online state, no real call)."""
    return {"provider": "anthropic", "api_key": "sk-ant-test-fake", "model": "claude-3-5-sonnet-20241022"}


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_assistant_unconfigured_honest_notice():
    """When no API key is configured, assistant must return explicit unconfigured status — never canned fake text."""
    with patch("app.services.assistant_service.get_llm_config", side_effect=_mock_llm_config_no_key):
        res = get_assistant_reply("What is the volume utilization?")
    assert res.mode == "offline"
    assert "AI Assistant is not configured" in res.reply
    assert "Settings" in res.reply


def test_tool_calculate_mckee():
    """Verify the McKee compression formula calculation tool."""
    # BCT = 5.876 * ECT * sqrt(Perimeter * Thickness)
    # ECT = 6.5 kN/m, Perimeter = 1600 mm, Thickness = 4.0 mm
    # sqrt(1600 * 4) = 80
    # BCT = 5.876 * 6.5 * 80 = 3055.52 N
    result = tool_calculate_mckee(ect_kn_m=6.5, perimeter_mm=1600.0, thickness_mm=4.0)
    assert "bct_newtons" in result
    assert "bct_kgf" in result
    assert abs(result["bct_newtons"] - 3055.5) < 1.0
    assert result["safe_load_at_safety_factor_4_5"] > 0


def test_get_llm_config_defaults():
    """Verify LLM config loading returns the expected keys."""
    from app.services.assistant_service import get_llm_config
    cfg = get_llm_config()
    assert "provider" in cfg
    assert "model" in cfg
    assert "api_key" in cfg


@patch("app.services.assistant_service.call_anthropic_claude")
def test_assistant_online_with_key(mock_claude):
    """When API key is provided, assistant invokes the provider and returns ai mode."""
    mock_claude.return_value = "Based on McKee formula, the recommended ECT is 6.5 kN/m."
    with patch("app.services.assistant_service.get_llm_config", side_effect=_mock_llm_config_with_key):
        res = get_assistant_reply("How strong should the carton be?")
    assert res.mode == "ai"
    assert "Based on McKee formula" in res.reply
    assert res.provider_name == "anthropic"
    mock_claude.assert_called_once()
def test_offline_assistant_answers_missing_fields_from_page_context(monkeypatch):
    from app.services import assistant_service

    monkeypatch.setattr(assistant_service, "get_llm_config", lambda: {"provider": "gemini", "api_key": "", "model": "gemini-2.5-flash"})
    response = assistant_service.get_assistant_reply(
        message="What required information is still missing from this project?",
        page_context={"route": "/projects/new", "missing_fields": ["Fragility class"], "api_key": "must-not-be-used"},
    )
    assert response.reply == "Required information still missing: Fragility class."
    assert response.fields_cited == ["missing_fields"]
    assert "**" not in response.reply
