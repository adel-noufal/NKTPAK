"""
NxtPak AI — Database Migration & Cleanup Script (Revision v6)
Removes legacy fake seeded demo projects and ensures new schema columns exist.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import engine

logger = logging.getLogger(__name__)

# Legacy fake project keywords to purge
LEGACY_FAKE_KEYWORDS = [
    "toshiba",
    "generic stand fan",
    "generic table blender",
    "stand fan packaging project",
    "table blender packaging project",
    "electronics packaging project",
]


def run_database_migrations() -> None:
    """Run schema updates and purge legacy fake projects from database."""
    with engine.connect() as conn:
        # 1. Check existing columns in 'projects' table
        try:
            res = conn.execute(text("PRAGMA table_info(projects)"))
            existing_cols = {row[1] for row in res.fetchall()}
            
            # Add missing columns if they don't exist yet
            if existing_cols:
                if "components_data" not in existing_cols:
                    logger.info("Migrating schema: adding components_data column to projects")
                    conn.execute(text("ALTER TABLE projects ADD COLUMN components_data JSON DEFAULT '[]'"))
                if "planned_data" not in existing_cols:
                    logger.info("Migrating schema: adding planned_data column to projects")
                    conn.execute(text("ALTER TABLE projects ADD COLUMN planned_data JSON"))
                if "chat_history" not in existing_cols:
                    logger.info("Migrating schema: adding chat_history column to projects")
                    conn.execute(text("ALTER TABLE projects ADD COLUMN chat_history JSON DEFAULT '[]'"))
                conn.commit()
        except Exception as e:
            logger.warning("Error checking/updating schema: %s", e)

        # 2. Delete previously seeded fake demo projects
        try:
            for kw in LEGACY_FAKE_KEYWORDS:
                del_sql = text("DELETE FROM projects WHERE lower(name) LIKE :kw OR lower(description) LIKE :kw")
                del_res = conn.execute(del_sql, {"kw": f"%{kw}%"})
                if del_res.rowcount > 0:
                    logger.info("Migration purged %d legacy fake project(s) matching '%s'", del_res.rowcount, kw)
            conn.commit()
        except Exception as e:
            logger.warning("Error purging legacy fake projects: %s", e)
