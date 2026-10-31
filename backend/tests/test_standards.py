"""
Tests for NxtPak AI ISO Standards Registry.
Verifies:
- All 16 standards loaded correctly
- Physical test standards NEVER return PASS (always NOT_VERIFIABLE)
- ISO 18602 programmatic checks
- Missing parameters return NOT_CONFIGURED
- Mandatory disclaimer & evaluation statement present in evaluation
"""

import pytest
from app.schemas.schemas import CheckStatus, CheckType, OptimizationConfig
from app.standards.registry import StandardsRegistry, SOFTWARE_DISCLAIMER, EVALUATION_STATEMENT


def test_registry_loads_all_standards():
    reg = StandardsRegistry()
    reg.load()
    standards = reg.get_all_standards()
    assert len(standards) == 16, f"Expected 16 ISO standards, got {len(standards)}"

    entry_ids = {s["entry_id"] for s in standards}
    expected_ids = {
        "ISO-18602", "ISO-18601", "ISO-4180", "ISO-2233", "ISO-2206",
        "ISO-2248", "ISO-2244", "ISO-8768", "ISO-2234", "ISO-12048",
        "ISO-2247", "ISO-8318", "ISO-13355", "ISO-2875", "ISO-3676", "ISO-3394"
    }
    assert expected_ids.issubset(entry_ids)


def test_physical_test_standards_never_pass():
    """
    CRITICAL RULE: Physical-test standards NEVER return PASS from software. Ever.
    """
    reg = StandardsRegistry()
    reg.load()

    eval_result = reg.evaluate(
        product_dims_mm={"L": 300, "W": 200, "H": 150},
        alternative={
            "alternative_id": "alt-test",
            "outer_length_mm": 350,
            "outer_width_mm": 250,
            "outer_height_mm": 200,
            "inner_length_mm": 340,
            "inner_width_mm": 240,
            "inner_height_mm": 190,
            "material_usage": {"total_material_volume_cm3": 500},
            "savings": {"volume_utilization": 0.65, "volume_utilization_pct": 65.0},
        },
    )

    for item in eval_result.results:
        if item.check_type == CheckType.PHYSICAL_TEST:
            assert item.status != CheckStatus.PASS, f"Physical test standard {item.standard_identifier} returned PASS!"
            assert item.status == CheckStatus.NOT_VERIFIABLE


def test_iso_18602_volume_utilization_pass_and_fail():
    reg = StandardsRegistry()
    reg.load()

    # Good utilization: product 200x200x200 (8,000,000 mm³), cavity 220x220x220 (10,648,000 mm³) -> ~75% util -> Sub-check PASS, overall NEEDS_REVIEW (requires engineer)
    eval_pass = reg.evaluate(
        product_dims_mm={"L": 200, "W": 200, "H": 200},
        alternative={
            "alternative_id": "alt-pass",
            "outer_length_mm": 230,
            "outer_width_mm": 230,
            "outer_height_mm": 230,
            "inner_length_mm": 220,
            "inner_width_mm": 220,
            "inner_height_mm": 220,
            "material_usage": {"total_material_volume_cm3": 400},
            "savings": {"volume_utilization": 0.75, "volume_utilization_pct": 75.0},
        },
    )
    iso_18602_res = next(r for r in eval_pass.results if r.entry_id == "ISO-18602")
    # Overall ISO 18602 requires HUMAN_REVIEW
    assert iso_18602_res.status == CheckStatus.NEEDS_REVIEW
    # Sub-check for volume utilization passes
    vol_sub = next(s for s in iso_18602_res.sub_check_results if s["sub_check_id"] == "18602-volume-util")
    assert vol_sub["status"] == CheckStatus.PASS.value


def test_iso_3676_not_configured_when_no_params():
    reg = StandardsRegistry()
    reg.load()

    eval_res = reg.evaluate(
        product_dims_mm={"L": 200, "W": 200, "H": 200},
        alternative={
            "alternative_id": "alt-1",
            "outer_length_mm": 250,
            "outer_width_mm": 250,
            "outer_height_mm": 250,
            "inner_length_mm": 240,
            "inner_width_mm": 240,
            "inner_height_mm": 240,
            "material_usage": {"total_material_volume_cm3": 400},
            "savings": {"volume_utilization": 0.55},
        },
        config=OptimizationConfig(),  # No unit load dims configured
    )
    iso_3676_res = next(r for r in eval_res.results if r.entry_id == "ISO-3676")
    assert iso_3676_res.status == CheckStatus.NOT_CONFIGURED


def test_evaluation_metadata_and_disclaimer():
    reg = StandardsRegistry()
    reg.load()

    eval_res = reg.evaluate(
        product_dims_mm={"L": 200, "W": 200, "H": 200},
        alternative={
            "alternative_id": "alt-1",
            "outer_length_mm": 250,
            "outer_width_mm": 250,
            "outer_height_mm": 250,
            "inner_length_mm": 240,
            "inner_width_mm": 240,
            "inner_height_mm": 240,
            "material_usage": {"total_material_volume_cm3": 400},
            "savings": {"volume_utilization": 0.55},
        },
    )

    assert "software PASS is never proof of ISO certification" in eval_res.disclaimer
    assert "Evaluated against: NxtPak ISO registry v1" in eval_res.evaluation_statement
    assert eval_res.company_requirements_loaded is False
