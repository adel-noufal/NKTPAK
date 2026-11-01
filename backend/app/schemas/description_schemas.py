"""
NxtPak AI — Description extraction schemas.
Used by POST /api/v1/extract-from-description endpoint.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List


class DescriptionExtractRequest(BaseModel):
    text: str
    language: str = "en"


class ExtractedField(BaseModel):
    field: str
    value: Optional[str] = None
    provenance: str = "AI_ESTIMATED"  # AI_ESTIMATED | USER_ENTERED | FETCHED
    confidence: Optional[float] = None  # 0–1, only for AI_ESTIMATED
    missing: bool = False


class ProjectDraft(BaseModel):
    """
    Structured draft extracted from a free-text project description.
    Every field carries provenance; missing fields are flagged so the UI can ask follow-up questions.
    """
    name: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    sku: Optional[str] = None
    product_length_mm: Optional[float] = None
    product_width_mm: Optional[float] = None
    product_height_mm: Optional[float] = None
    net_weight_kg: Optional[float] = None
    fragility: Optional[str] = None
    carton_length_mm: Optional[float] = None
    carton_width_mm: Optional[float] = None
    carton_height_mm: Optional[float] = None
    board_type: Optional[str] = None
    units_per_carton: Optional[int] = None
    notes: Optional[str] = None

    fields: List[ExtractedField] = []
    missing_required: List[str] = []
    llm_offline: bool = False
    extraction_notes: str = ""
