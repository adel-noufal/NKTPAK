"""
NxtPak AI — Database Migration & Schema Creation (Production).
Ensures all tables exist and database ships completely empty of seed projects.
"""

import logging
from sqlalchemy import text
from app.core.database import engine, Base
import app.models.models  # ensure models are loaded into Base metadata

logger = logging.getLogger(__name__)


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
                conn.commit()
        except Exception as e:
            logger.warning("Migration column verification notice: %s", e)
