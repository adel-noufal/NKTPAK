"""
NxtPak AI — Database Migration & Schema Creation (Production).
Ensures all tables exist and database ships completely empty of seed projects.
"""

import logging
import json
import re
from pathlib import Path
from sqlalchemy import text
from app.core.database import engine, Base
from app.core.config import settings
from app.models.models import StandardsCatalogEntry
import app.models.models  # ensure models are loaded into Base metadata

logger = logging.getLogger(__name__)


def seed_standards_catalog() -> int:
    """Seed the editable SQL catalog from verified metadata files, once per identifier."""
    iso_path = Path(settings.standards_registry_path)
    files = (iso_path, iso_path.parent / "ista_registry.json")
    rows: list[dict] = []
    for path in files:
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as source:
            registry_data = json.load(source)
        for item in registry_data.get("standards", []):
            identifier = item.get("standard_identifier", "")
            organization = "ISTA" if identifier.upper().startswith("ISTA") else "ISO"
            if organization == "ISTA":
                series = identifier.removeprefix("ISTA ").split("-")[0][:1]
                test_summaries = {
                    "1": "Non-simulation integrity of the package-product combination; this series is a screening test and does not simulate environmental occurrences.",
                    "2": "Partial-simulation performance; combines integrity-test elements with one or more general-simulation elements. Consult the official procedure for its test elements.",
                    "3": "General simulation of transport motions, forces, conditions, and sequences for the stated distribution scope. Consult the current procedure for its exact test elements.",
                    "6": "Member performance evaluation for the named distribution program. Consult the current official project for the applicable test elements and product type.",
                }
                what_it_tests = item.get("what_it_tests") or test_summaries.get(series, "Physical performance evaluation; consult the current official procedure for scope-specific test elements.")
            else:
                what_it_tests = item.get("what_it_tests", "See the official standard scope and licensed text for test requirements.")
            rows.append({
                "entry_id": item.get("entry_id") or identifier.replace(" ", "-"),
                "organization": organization,
                "standard_identifier": identifier,
                "title": item.get("title", identifier),
                "title_ar": item.get("title_ar"),
                "scope_summary": item.get("scope_summary", "See official source."),
                "scope_summary_ar": item.get("scope_summary_ar"),
                "what_it_tests": what_it_tests,
                "when_it_applies": item.get("when_it_applies", item.get("scope_summary", "See official scope.")),
                "source_url": item.get("source_url", ""),
                "version": str(item.get("edition") or item.get("version") or "") or None,
                "last_verified_date": item.get("last_verified_date") or item.get("retrieval_date"),
                "check_type": item.get("check_type", "PHYSICAL_TEST"),
                "applicability_rules": item.get("applicability_rules") or {},
                "is_user_editable": False,
            })
    inserted = 0
    with engine.begin() as conn:
        existing = {row[0]: bool(row[1]) for row in conn.execute(text("SELECT standard_identifier, is_user_editable FROM standards_catalog"))}
        for row in rows:
            identifier = row["standard_identifier"]
            if identifier in existing and existing[identifier]:
                continue
            if identifier in existing:
                conn.execute(text("""UPDATE standards_catalog SET organization=:organization, title=:title, title_ar=:title_ar,
                    scope_summary=:scope_summary, scope_summary_ar=:scope_summary_ar, what_it_tests=:what_it_tests,
                    when_it_applies=:when_it_applies, source_url=:source_url, version=:version,
                    last_verified_date=:last_verified_date, check_type=:check_type, applicability_rules=:applicability_rules
                    WHERE standard_identifier=:standard_identifier"""), {**row, "applicability_rules": json.dumps(row["applicability_rules"])})
                inserted += 1
                continue
            conn.execute(text("""INSERT INTO standards_catalog
                (entry_id, organization, standard_identifier, title, title_ar, scope_summary, scope_summary_ar,
                 what_it_tests, when_it_applies, source_url, version, last_verified_date, check_type,
                 applicability_rules, is_user_editable)
                VALUES (:entry_id, :organization, :standard_identifier, :title, :title_ar, :scope_summary, :scope_summary_ar,
                 :what_it_tests, :when_it_applies, :source_url, :version, :last_verified_date, :check_type,
                 :applicability_rules, :is_user_editable)"""), {**row, "applicability_rules": json.dumps(row["applicability_rules"])})
            existing[identifier] = False
            inserted += 1
    return inserted


def restore_legacy_product_payload(
    product_data: object,
    description: str | None,
    project_name: str | None,
    brand: str | None,
    model_number: str | None,
    components_data: object,
) -> tuple[dict, list, bool]:
    """Recover only product values explicitly retained in legacy project text."""
    data = dict(product_data) if isinstance(product_data, dict) else {}
    components = list(data.get("components")) if isinstance(data.get("components"), list) else (list(components_data) if isinstance(components_data, list) else [])
    changed = False
    text_value = description or ""
    if not data.get("name") and project_name:
        data["name"] = project_name
        changed = True
    if not data.get("brand") and brand:
        data["brand"] = brand
        changed = True
    if not data.get("model") and model_number:
        data["model"] = model_number
        changed = True

    dims = data.get("packed_dimensions")
    has_valid_dims = isinstance(dims, dict) and all(
        isinstance(dims.get(key), (int, float)) and dims[key] > 0
        for key in ("length", "width", "height")
    )
    if not has_valid_dims:
        match = re.search(
            r"product dimensions\s*[:=]?\s*(\d+(?:\.\d+)?)\s*[x×]\s*"
            r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm\b",
            text_value,
            re.IGNORECASE,
        )
        if match:
            data["packed_dimensions"] = {
                "length": float(match.group(1)),
                "width": float(match.group(2)),
                "height": float(match.group(3)),
                "unit": "mm",
            }
            data["dimensions_provenance"] = {
                "source_name": "Saved project description",
                "source_url": None,
                "retrieval_date": None,
                "source_type": "USER_ENTERED",
                "is_edited": False,
            }
            changed = True

    if not data.get("weight_kg"):
        weight_match = re.search(r"net weight\s*[:=]?\s*(\d+(?:\.\d+)?)\s*kg\b", text_value, re.IGNORECASE)
        if weight_match:
            data["weight_kg"] = float(weight_match.group(1))
            changed = True

    product_type = data.get("product_type")
    component_text = " ".join(str(item.get("name", "")) for item in components if isinstance(item, dict)).casefold()
    stale_fan_components = product_type == "blender" and any(
        token in component_text for token in ("fan", "guard", "aerofoil", "telescopic pole", "stand pole", "pedestal")
    )
    if stale_fan_components:
        components = []
        data["components"] = []
        changed = True
    elif "components" not in data and components:
        data["components"] = components
        changed = True
    return data, components, changed


def migrate_legacy_project_rows(conn) -> int:
    """Migrate saved JSON payloads in an old projects table without guessing values."""
    rows = conn.execute(text("SELECT id, name, brand, model_number, description, product_data, components_data FROM projects")).fetchall()
    migrated = 0
    for row in rows:
        try:
            product_data = json.loads(row[5]) if isinstance(row[5], str) else row[5]
        except (TypeError, json.JSONDecodeError):
            product_data = {}
        try:
            components = json.loads(row[6]) if isinstance(row[6], str) else row[6]
        except (TypeError, json.JSONDecodeError):
            components = []
        safe_product = product_data if isinstance(product_data, dict) else {}
        identity = f"{row[1] or ''} {row[3] or ''} {safe_product.get('name') or ''} {safe_product.get('model') or ''}".casefold()
        inferred_type = False
        if not safe_product.get("product_type"):
            type_terms = (
                ("ceiling_fan", ("ceiling fan",)), ("stand_fan", ("stand fan", "pedestal fan", "tsf-", "tsf ", "fan")),
                ("blender", ("blender", "bl500", "mx5200")), ("washing_machine", ("washing machine", "washer", "vh-720")),
                ("refrigerator", ("refrigerator", "fridge")), ("air_conditioner", ("air conditioner", "split ac")),
                ("tv", ("television", "smart tv", " led tv")), ("kettle", ("kettle",)),
                ("microwave", ("microwave",)), ("water_heater", ("water heater",)),
            )
            safe_product["product_type"] = next((kind for kind, terms in type_terms if any(term in identity for term in terms)), "other")
            inferred_type = True
        product_data, components, changed = restore_legacy_product_payload(
            safe_product, row[4], row[1], row[2], row[3], components,
        )
        if changed or inferred_type:
            conn.execute(
                text("UPDATE projects SET product_data = :product_data, components_data = :components_data WHERE id = :id"),
                {"product_data": json.dumps(product_data), "components_data": json.dumps(components), "id": row[0]},
            )
            migrated += 1
    return migrated


def run_database_migrations() -> None:
    """Create tables if not existing, add missing columns, ensure zero seed projects."""
    # 1. Create tables according to current models
    Base.metadata.create_all(bind=engine)

    # 2. Add columns if migrating an existing SQLite database
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(projects)"))
            existing_cols = {row[1] for row in res.fetchall()}

            if existing_cols:
                if "brand" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN brand VARCHAR(100) DEFAULT ''"))
                if "model_number" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN model_number VARCHAR(100) DEFAULT ''"))
                if "sku" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN sku VARCHAR(100)"))
                if "components_data" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN components_data JSON DEFAULT '[]'"))
                if "planned_data" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN planned_data JSON"))
                if "chat_history" not in existing_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN chat_history JSON DEFAULT '[]'"))
                migrate_legacy_project_rows(conn)
                conn.commit()
        except Exception as e:
            logger.warning("Migration column verification notice: %s", e)
    try:
        count = seed_standards_catalog()
        logger.info("Seeded %d standards catalog entries", count)
    except Exception:
        logger.exception("Could not seed editable standards catalog")
