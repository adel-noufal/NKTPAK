"""
Tests for NxtPak AI Validation module.
"""

import pytest
from app.validation.validator import (
    validate_product_dims,
    validate_baseline,
    validate_export_file,
)


def test_validate_product_dims_valid():
    res = validate_product_dims(300, 200, 150, 2.5)
    assert res.is_valid is True
    assert len(res.errors) == 0


def test_validate_product_dims_invalid():
    # Negative and zero dimensions
    res1 = validate_product_dims(0, 200, 150, 2.5)
    assert res1.is_valid is False
    assert any("Length must be greater than 0" in e for e in res1.errors)

    res2 = validate_product_dims(300, -50, 150, 2.5)
    assert res2.is_valid is False
    assert any("Width must be greater than 0" in e for e in res2.errors)

    # Impossibly large dimension
    res3 = validate_product_dims(20000, 200, 150, 2.5)
    assert res3.is_valid is False
    assert any("exceeds reasonable limit" in e for e in res3.errors)

    # Negative weight
    res4 = validate_product_dims(300, 200, 150, -1.0)
    assert res4.is_valid is False
    assert any("Weight must be greater than 0" in e for e in res4.errors)


def test_validate_baseline():
    valid_baseline = {
        "carton_outer_length_mm": 500,
        "carton_outer_width_mm": 400,
        "carton_outer_height_mm": 300,
        "board_thickness_mm": 4,
    }
    assert validate_baseline(valid_baseline).is_valid is True

    # Board thickness larger than half carton dimension
    invalid_baseline = {
        "carton_outer_length_mm": 20,
        "carton_outer_width_mm": 400,
        "carton_outer_height_mm": 300,
        "board_thickness_mm": 15,  # 2 * 15 = 30 > 20
    }
    res = validate_baseline(invalid_baseline)
    assert res.is_valid is False
    assert any("exceeds carton length" in e for e in res.errors)


def test_validate_export_file_nonexistent():
    res = validate_export_file("nonexistent_report.pdf")
    assert res.is_valid is False
    assert any("not found" in e for e in res.errors)
