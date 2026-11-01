import json
from sqlalchemy import create_engine, text

from app.core.migration import migrate_legacy_project_rows, restore_legacy_product_payload


def test_old_project_payload_migration_recovers_only_description_values_and_drops_foreign_parts():
    old_product_data = {"product_type": "blender"}
    old_fan_parts = [{"name": "Telescopic Stand Pole", "length_mm": 650, "width_mm": 45, "height_mm": 45}]
    product, components, changed = restore_legacy_product_payload(
        old_product_data,
        "Tornado table blender, net weight 3.2 kg, product dimensions 180 × 165 × 390 mm.",
        "Tornado table blender",
        "Tornado",
        "BL500/2",
        old_fan_parts,
    )

    assert changed is True
    assert product["packed_dimensions"] == {"length": 180.0, "width": 165.0, "height": 390.0, "unit": "mm"}
    assert product["weight_kg"] == 3.2
    assert product["product_type"] == "blender"
    assert product["components"] == []
    assert components == []


def test_legacy_migration_does_not_invent_dimensions_when_description_has_none():
    product, components, _ = restore_legacy_product_payload({"product_type": "blender"}, "Tornado blender", "Tornado blender", None, None, [])
    assert "packed_dimensions" not in product
    assert components == []


def test_old_schema_sqlite_row_is_migrated_and_reloaded():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, brand TEXT, model_number TEXT, description TEXT, product_data TEXT, components_data TEXT)"))
        conn.execute(text("INSERT INTO projects VALUES (:id,:name,:brand,:model,:description,:product,:components)"), {
            "id": "legacy-1", "name": "Tornado table blender", "brand": "Tornado", "model": "BL500/2",
            "description": "net weight 3.2 kg, product dimensions 180 × 165 × 390 mm.",
            "product": json.dumps({"product_type": "blender"}),
            "components": json.dumps([{"name": "Telescopic Stand Pole"}]),
        })
        assert migrate_legacy_project_rows(conn) == 1
        row = conn.execute(text("SELECT product_data, components_data FROM projects WHERE id='legacy-1'")).one()
        restored = json.loads(row[0])
        assert restored["packed_dimensions"]["length"] == 180.0
        assert restored["weight_kg"] == 3.2
        assert json.loads(row[1]) == []
    engine.dispose()
