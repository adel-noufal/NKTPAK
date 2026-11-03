"""
Shared pytest configuration for NxtPak AI backend tests.
Uses an isolated test database so production nxtpak.db is never touched.
"""
import os
import pytest


@pytest.fixture(autouse=True)
def disable_live_product_search_in_unit_tests(monkeypatch):
    """Keep the unit suite deterministic; live Gemini search is verified separately against the running service."""
    from app.services import fetch_service

    monkeypatch.setattr(
        fetch_service,
        "_gemini_grounded_product_search",
        lambda *args, **kwargs: ([], {"source": "Gemini Google Search", "status": "not_called", "count": 0, "error": "Live search is disabled in unit tests."}),
    )
    monkeypatch.setattr(
        fetch_service,
        "_bing_web_product_search",
        lambda *args, **kwargs: ([], {"source": "Bing Web Search", "status": "not_called", "count": 0}),
    )

# ── Set test DB BEFORE any app modules are imported ──────────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_nxtpak.db")
# Clear any live API key so assistant tests don't accidentally call real APIs
os.environ.setdefault("LLM_API_KEY", "")

from app.core.database import engine, Base, SessionLocal, init_db  # noqa: E402
from app.standards.registry import get_registry  # noqa: E402


def pytest_configure(config):
    """Initialise the test schema once before any tests run."""
    # Remove stale test DB if present
    test_db_path = "./test_nxtpak.db"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    init_db()
    get_registry().load()


def pytest_unconfigure(config):
    """Drop the test DB after the full test session."""
    test_db_path = "./test_nxtpak.db"
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except OSError:
            pass


@pytest.fixture(scope="function")
def db_session():
    """Yield a clean DB session, roll back after each test."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
