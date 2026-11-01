"""
NxtPak AI — SQLAlchemy ORM Models (Production).
Ships with clean schema, zero seed projects, zero hardcoded demo records.
"""

from sqlalchemy import String, Float, Integer, Boolean, Text, DateTime, JSON, Index
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
    brand: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    model_number: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    sku: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    language: Mapped[str] = mapped_column(String(5), default="en")

    # Structured engineering data
    product_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    components_data: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    baseline_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    planned_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    optimization_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    optimization_result: Mapped[dict] = mapped_column(JSON, nullable=True)
    standards_result: Mapped[dict] = mapped_column(JSON, nullable=True)
    chat_history: Mapped[list] = mapped_column(JSON, nullable=True, default=list)

    # Selected alternative
    selected_alternative_id: Mapped[str] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_projects_brand_model", "brand", "model_number"),
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r} brand={self.brand!r} model={self.model_number!r} status={self.status}>"


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


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class ProductCache(Base):
    __tablename__ = "product_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    source_url: Mapped[str] = mapped_column(String(500), nullable=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class StandardsCatalogEntry(Base):
    """Editable standards metadata catalog; test procedures remain external copyrighted material."""
    __tablename__ = "standards_catalog"

    entry_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    organization: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    standard_identifier: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    title_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scope_summary: Mapped[str] = mapped_column(Text, nullable=False)
    scope_summary_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    what_it_tests: Mapped[str] = mapped_column(Text, nullable=False, default="See current official procedure.")
    when_it_applies: Mapped[str] = mapped_column(Text, nullable=False, default="Refer to the scope summary.")
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_verified_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    check_type: Mapped[str] = mapped_column(String(30), nullable=False, default="PHYSICAL_TEST")
    applicability_rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_user_editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
