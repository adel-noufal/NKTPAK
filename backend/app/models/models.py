"""
NxtPak AI — SQLAlchemy ORM Models.
Stores projects and their computed results.
"""

from sqlalchemy import String, Float, Integer, Boolean, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.core.database import Base
import uuid


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    language: Mapped[str] = mapped_column(String(5), default="en")

    # Stored as JSON blobs for data model in Revision v6
    product_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    components_data: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    baseline_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    planned_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    optimization_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    optimization_result: Mapped[dict] = mapped_column(JSON, nullable=True)
    standards_result: Mapped[dict] = mapped_column(JSON, nullable=True)
    chat_history: Mapped[list] = mapped_column(JSON, nullable=True, default=list)

    # Selected alternative
    selected_alternative_id: Mapped[str] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r} status={self.status}>"


class ExportRecord(Base):
    __tablename__ = "export_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), nullable=False)
    alternative_id: Mapped[str] = mapped_column(String(36), nullable=True)
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    validation_notes: Mapped[list] = mapped_column(JSON, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
