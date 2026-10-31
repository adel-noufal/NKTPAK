"""
Tests for Assistant Service (rule-based offline analysis and citation tracking).
"""

from app.services.assistant_service import get_assistant_reply


def test_assistant_offline_no_project():
    res = get_assistant_reply("Hello")
    assert res.mode == "offline"
    assert "don't have project data" in res.reply


def test_assistant_offline_what_is_missing():
    project_data = {
        "product": {"name": "Tornado Stand Fan TSF-16W"},
        "baseline": {"carton_outer_length_mm": 575},
        "optimization_result": None,
    }
    res = get_assistant_reply("What is missing?", project_data=project_data)
    assert res.mode == "offline"
    assert "Missing data" in res.reply
    assert "Fragility class" in res.reply or "dimensions" in res.reply


def test_assistant_offline_volume_utilization():
    project_data = {
        "product": {"name": "Fan"},
        "optimization_result": {
            "recommended": {
                "outer_length_mm": 500,
                "outer_width_mm": 400,
                "outer_height_mm": 300,
                "savings": {"volume_utilization_pct": 68.5},
            }
        },
    }
    res = get_assistant_reply("What is the volume utilization?", project_data=project_data)
    assert res.mode == "offline"
    assert "68.5%" in res.reply
    assert "savings.volume_utilization_pct" in res.fields_cited


def test_assistant_offline_iso_explanation():
    res = get_assistant_reply("Explain ISO compliance standards", project_data={"product": {"name": "Test"}})
    assert res.mode == "offline"
    assert "Physical-test standards" in res.reply
    assert "NEVER return PASS" in res.reply
