"""
NxtPak AI — Database setup and session management.
Uses SQLAlchemy 2.x session with SQLite.
Fallback note: Python 3.13 on Windows sandboxes has known threading deadlocks with aiosqlite;
standard thread-safe SQLite connection is used for rock-solid reliability.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import settings

# Strip +aiosqlite if present
db_url = settings.database_url.replace("+aiosqlite", "")

engine = create_engine(
    db_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Call on startup."""
    from app.models import models  # Ensure models are loaded
    Base.metadata.create_all(bind=engine)
