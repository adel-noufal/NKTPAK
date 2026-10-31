"""
NxtPak AI — All Pydantic schemas (request/response models).
Revision v6: Real data model with provenance, components, optional baseline board thickness.
Explicit units everywhere. Never fabricates numeric values.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Literal, Dict, Any
from enum import Enum
from datetime import datetime
import uuid


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class FragilityClass(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


class DimensionUnit(str, Enum):
    MM = "mm"
    CM = "cm"
    M = "m"
    INCH = "inch"


class SourceType(str, Enum):
    EL_ARABY_DATASHEET = "EL_ARABY_DATASHEET"
    EL_ARABY_WEBSITE = "EL_ARABY_WEBSITE"
    PUBLIC_RETAIL = "PUBLIC_RETAIL"
    USER_ENTERED = "USER_ENTERED"
    DERIVED = "DERIVED"
    SAMPLE_DATA = "SAMPLE_DATA"
    OFFICIAL_COMPANY = "OFFICIAL_COMPANY"


class DataLabel(str, Enum):
    SAMPLE_DATA = "SAMPLE DATA"
    SAMPLE_DATA_ALT = "SAMPLE_DATA"
    PUBLIC_RETAIL_UNVERIFIED = "PUBLIC RETAIL DATA - UNVERIFIED"
    PUBLIC_RETAIL_ALT = "PUBLIC_RETAIL_DATA - UNVERIFIED"
    USER_ENTERED = "USER ENTERED"
    USER_ENTERED_ALT = "USER_ENTERED"
    UNVERIFIED = "UNVERIFIED"
    ESTIMATE = "ESTIMATE"
    VERIFIED = "VERIFIED"
    EL_ARABY_DATASHEET = "EL_ARABY_DATASHEET"
    EL_ARABY_WEBSITE = "EL_ARABY_WEBSITE"
    DERIVED = "DERIVED"


class CheckType(str, Enum):
    PROGRAMMATIC = "PROGRAMMATIC"
    PHYSICAL_TEST = "PHYSICAL_TEST"
    HUMAN_REVIEW = "HUMAN_REVIEW"


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"


class AlternativeRank(str, Enum):
    RECOMMENDED = "RECOMMENDED"
    ALTERNATIVE = "ALTERNATIVE"
    BASELINE = "BASELINE"


# ─────────────────────────────────────────────
# Provenance (used everywhere)
# ─────────────────────────────────────────────

class Provenance(BaseModel):
    source_name: str
    source_url: Optional[str] = None
    retrieval_date: Optional[str] = None
    source_type: SourceType = SourceType.USER_ENTERED
    is_edited: bool = False
    evidence_snippet: Optional[str] = None
    # Legacy compat
    data_label: Optional[str] = None
    verified: bool = False
    verification_note: Optional[str] = None


# ─────────────────────────────────────────────
# Product & Component Schemas
# ─────────────────────────────────────────────

class DimensionsInput(BaseModel):
    length: float = Field(..., gt=0, le=10000, description="Length in specified unit")
    width: float = Field(..., gt=0, le=10000, description="Width in specified unit")
    height: float = Field(..., gt=0, le=10000, description="Height in specified unit")
    unit: DimensionUnit = Field(default=DimensionUnit.MM)

    def to_mm(self) -> tuple[float, float, float]:
        """Convert dimensions to millimeters."""
        factor = {"mm": 1.0, "cm": 10.0, "m": 1000.0, "inch": 25.4}[self.unit.value]
        return self.length * factor, self.width * factor, self.height * factor


class ComponentInput(BaseModel):
    """A packed component (part as shipped, not assembled)."""
    name: str = Field(..., min_length=1, max_length=100)
    length_mm: Optional[float] = Field(None, gt=0, le=10000)
    width_mm: Optional[float] = Field(None, gt=0, le=10000)
    height_mm: Optional[float] = Field(None, gt=0, le=10000)
    weight_kg: Optional[float] = Field(None, gt=0, le=1000)
    quantity: int = Field(default=1, ge=1)
    fragility: Optional[FragilityClass] = None
    notes: Optional[str] = Field(None, max_length=500)
    provenance: Optional[Provenance] = None

    @property
    def has_dimensions(self) -> bool:
        return all(v is not None for v in [self.length_mm, self.width_mm, self.height_mm])


class ProductInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    model: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    # assembled_envelope is for reference display; the optimizer works from components
    packed_dimensions: Optional[DimensionsInput] = None
    weight_kg: Optional[float] = Field(None, gt=0, le=10000, description="Net weight in kg")
    fragility_class: Optional[FragilityClass] = None  # No hidden default — required user choice
    fragility_note: Optional[str] = Field(None, max_length=200)
    components: List[ComponentInput] = Field(default_factory=list)
    provenance: Optional[Provenance] = None
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("weight_kg")
    @classmethod
    def weight_reasonable(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v > 5000:
            raise ValueError("Weight exceeds 5000 kg — please verify")
        return v


# ─────────────────────────────────────────────
# Baseline Packaging Schema
# board_thickness_mm is Optional — may not be known
# ─────────────────────────────────────────────

class InsertInput(BaseModel):
    insert_type: str = Field(..., max_length=100, description="e.g. EPE foam, Polystyrene, Cardboard")
    description: Optional[str] = Field(None, max_length=200)
    quantity: int = Field(default=1, ge=1, le=1000)
    thickness_mm: Optional[float] = Field(None, gt=0, le=500)
    volume_cm3: Optional[float] = Field(None, gt=0)
    cost_per_unit: Optional[float] = Field(None, ge=0)
    unit_cost_label: DataLabel = DataLabel.USER_ENTERED


class BaselinePackaging(BaseModel):
    carton_outer_length_mm: float = Field(..., gt=0, le=10000)
    carton_outer_width_mm: float = Field(..., gt=0, le=10000)
    carton_outer_height_mm: float = Field(..., gt=0, le=10000)
    # board_thickness is optional: unknown until user measures it
    board_thickness_mm: Optional[float] = Field(None, gt=0, le=50,
        description="Corrugated board wall thickness — leave None if unknown")
    board_type: Optional[str] = Field(None, max_length=100)
    inserts: List[InsertInput] = Field(default_factory=list)
    carton_cost_per_unit: Optional[float] = Field(None, ge=0)
    total_insert_cost_per_unit: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    data_label: DataLabel = DataLabel.USER_ENTERED
    notes: Optional[str] = Field(None, max_length=500)
    provenance: Optional[Provenance] = None

    @property
    def inner_length_mm(self) -> Optional[float]:
        if self.board_thickness_mm is None:
            return None
        return self.carton_outer_length_mm - 2 * self.board_thickness_mm

    @property
    def inner_width_mm(self) -> Optional[float]:
        if self.board_thickness_mm is None:
            return None
        return self.carton_outer_width_mm - 2 * self.board_thickness_mm

    @property
    def inner_height_mm(self) -> Optional[float]:
        if self.board_thickness_mm is None:
            return None
        return self.carton_outer_height_mm - 2 * self.board_thickness_mm

    @property
    def total_cost_per_unit(self) -> Optional[float]:
        if self.carton_cost_per_unit is None or self.total_insert_cost_per_unit is None:
            return None
        return self.carton_cost_per_unit + self.total_insert_cost_per_unit


# ─────────────────────────────────────────────
# Planned Packaging (user's own proposed dims)
# ─────────────────────────────────────────────

class PlannedPackaging(BaseModel):
    """User's manually entered planned packaging for comparison."""
    carton_outer_length_mm: float = Field(..., gt=0, le=10000)
    carton_outer_width_mm: float = Field(..., gt=0, le=10000)
    carton_outer_height_mm: float = Field(..., gt=0, le=10000)
    board_thickness_mm: Optional[float] = Field(None, gt=0, le=50)
    notes: Optional[str] = Field(None, max_length=500)
    provenance: Optional[Provenance] = None


# ─────────────────────────────────────────────
# Optimization Config
# Clearances labeled as engineering assumptions, no ISO badge
# ─────────────────────────────────────────────

class OptimizationConfig(BaseModel):
    min_clearance_mm: float = Field(
        default=15.0, ge=0, le=200,
        description="Engineering assumption: minimum clearance between product and inner carton wall (mm)."
    )
    standard_clearance_mm: float = Field(
        default=25.0, ge=0, le=200,
        description="Engineering assumption: standard clearance for normal handling (mm)."
    )
    generous_clearance_mm: float = Field(
        default=40.0, ge=0, le=200,
        description="Engineering assumption: generous clearance for high-fragility products (mm)."
    )
    board_thickness_mm: float = Field(
        default=4.0, ge=1, le=20,
        description="Assumed corrugated board thickness for alternatives (mm). Engineering assumption."
    )
    insert_thickness_mm: float = Field(
        default=25.0, ge=0, le=100,
        description="Assumed cushion/insert thickness per side (mm). Engineering assumption."
    )
    assumption_label: str = Field(
        default="ENGINEERING_ASSUMPTION",
        description="These clearances are user-editable engineering assumptions, not ISO-specified values."
    )
    # ISO 3676 unit load check (optional, user-configured)
    unit_load_length_mm: Optional[float] = Field(None, gt=0)
    unit_load_width_mm: Optional[float] = Field(None, gt=0)
    unit_load_height_mm: Optional[float] = Field(None, gt=0)
    # ISO 3394 modular dimensions (optional, user-configured)
    module_length_mm: Optional[float] = Field(None, gt=0)
    module_width_mm: Optional[float] = Field(None, gt=0)


# ─────────────────────────────────────────────
# Project Create
# ─────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    product: ProductInput
    components: List[ComponentInput] = Field(default_factory=list)
    baseline: Optional[BaselinePackaging] = None
    planned: Optional[PlannedPackaging] = None
    optimization_config: OptimizationConfig = Field(default_factory=OptimizationConfig)
    language: Literal["en", "ar"] = Field(default="en")


class ProjectResponse(BaseModel):
    project_id: str
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    language: str

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Packaging Alternative Schemas
# ─────────────────────────────────────────────

class MaterialUsage(BaseModel):
    carton_board_area_cm2: float = Field(description="Total corrugated board area (cm²)")
    carton_board_volume_cm3: float = Field(description="Corrugated board volume including thickness (cm³)")
    insert_volume_cm3: float = Field(description="Total cushioning/insert material volume (cm³)")
    total_material_volume_cm3: float

    label: DataLabel = DataLabel.ESTIMATE
    formula_notes: str = Field(description="Formulas used in calculation")


class CostBreakdown(BaseModel):
    carton_cost: Optional[float] = None
    insert_cost: Optional[float] = None
    total_cost: Optional[float] = None
    currency: Optional[str] = None
    cost_label: DataLabel = DataLabel.USER_ENTERED
    cost_status: str = "NOT_CONFIGURED"


class SavingsMetrics(BaseModel):
    # ISO 18602-style metrics
    volume_utilization: float = Field(description="Product volume / packaging internal volume (0-1)")
    volume_utilization_pct: float = Field(description="Volume utilization as percentage")
    volume_utilization_formula: str = "product_volume_mm³ / packaging_internal_volume_mm³"

    # vs baseline (None if no baseline or board thickness unknown)
    material_saved_pct: Optional[float] = Field(None, description="Material reduction vs baseline (%)")
    material_saved_cm3: Optional[float] = Field(None, description="Material volume saved vs baseline (cm³)")
    material_savings_formula: str = "(baseline_usage - proposed_usage) / baseline_usage × 100"
    cost_saved: Optional[float] = Field(None, description="Cost saved per unit vs baseline")
    cost_saved_pct: Optional[float] = None
    currency: Optional[str] = None
    savings_label: DataLabel = DataLabel.ESTIMATE

    baseline_available: bool = False
    savings_status: str = Field(
        description="NOT_CONFIGURED if baseline missing; CALCULATED if computed from user-entered baseline"
    )
    inputs_used: Optional[List[str]] = Field(
        None, description="Which input fields this metric rests on"
    )


class PackagingAlternative(BaseModel):
    alternative_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    rank: AlternativeRank

    # Outer carton dimensions
    outer_length_mm: float
    outer_width_mm: float
    outer_height_mm: float
    board_thickness_mm: float

    # Inner cavity
    inner_length_mm: float
    inner_width_mm: float
    inner_height_mm: float

    # Clearances used (engineering assumptions — not ISO-mandated values)
    clearance_length_mm: float
    clearance_width_mm: float
    clearance_height_mm: float
    clearance_label: str = "ENGINEERING_ASSUMPTION — user-editable, not an ISO-specified value"

    # Insert/cushioning
    insert_thickness_mm: float
    insert_description: str

    # Metrics
    material_usage: MaterialUsage
    savings: SavingsMetrics
    cost: CostBreakdown

    # Ranking
    ranking_score: float = Field(description="Composite score for ranking (higher = better)")
    ranking_criteria: Dict[str, Any] = Field(description="Explicit criteria used for ranking")

    # Assumptions
    assumptions: List[str] = Field(description="All assumptions recorded for this alternative")
    data_label: str = "PRELIMINARY GEOMETRIC PROTOTYPE"

    # Standards results for this alternative
    standards_summary: Optional[Dict[str, Any]] = None


class OptimizationResult(BaseModel):
    project_id: str
    product_name: str
    product_volume_mm3: float
    alternatives: List[PackagingAlternative]
    recommended: PackagingAlternative
    baseline_included: bool
    calculation_notes: List[str]
    assumptions: List[str]
    result_label: str = "PRELIMINARY GEOMETRIC PROTOTYPE — for engineering review only"
    result_warning: str = (
        "These are deterministic geometric estimates. "
        "Protective adequacy has NOT been verified. "
        "Physical testing is required before production use."
    )


# ─────────────────────────────────────────────
# Standards Schemas
# ─────────────────────────────────────────────

class StandardsCheckResult(BaseModel):
    entry_id: str
    standard_identifier: str
    title: str
    check_type: CheckType
    status: CheckStatus
    details: str
    parameters_used: Dict[str, Any] = Field(default_factory=dict)
    sub_check_results: List[Dict[str, Any]] = Field(default_factory=list)
    what_is_still_required: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None


class StandardsEvaluationResult(BaseModel):
    project_id: str
    alternative_id: str
    evaluated_at: datetime
    registry_version: str
    registry_source: str = "NxtPak ISO registry v1 (see source list)"
    company_requirements_loaded: bool = False
    company_requirements_note: str = (
        "No company-specific requirements loaded. "
        "El Araby Group specifications are not publicly available."
    )
    evaluation_statement: str = (
        "Evaluated against: NxtPak ISO registry v1 (see source list). "
        "No company-specific requirements loaded."
    )
    results: List[StandardsCheckResult]
    programmatic_pass_count: int
    programmatic_fail_count: int
    not_configured_count: int
    not_verifiable_count: int
    needs_review_count: int
    disclaimer: str = (
        "A software PASS is never proof of ISO certification or successful physical testing. "
        "Physical-test standards require laboratory execution. "
        "No compliance certificates are generated."
    )


# ─────────────────────────────────────────────
# Fetch / Upload schemas
# ─────────────────────────────────────────────

class FetchProductRequest(BaseModel):
    """Request to auto-fetch product data from El Araby or a URL."""
    model_number: Optional[str] = Field(None, max_length=50)
    product_url: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def at_least_one(self) -> "FetchProductRequest":
        if not self.model_number and not self.product_url:
            raise ValueError("Provide either model_number or product_url")
        return self


class FetchedFieldValue(BaseModel):
    """A single fetched field with provenance and evidence."""
    field_name: str
    value: Any
    unit: Optional[str] = None
    source_url: str
    evidence_snippet: str
    source_type: SourceType
    retrieval_date: str
    is_edited: bool = False


class FetchProductResult(BaseModel):
    """Result from fetching product data — all fields show their source."""
    success: bool
    error: Optional[str] = None
    source_url: Optional[str] = None
    source_type: Optional[SourceType] = None
    retrieved_at: Optional[str] = None
    fields: List[FetchedFieldValue] = Field(default_factory=list)
    unresolved_fields: List[str] = Field(
        default_factory=list,
        description="Fields the parser could not find — must be entered manually"
    )
    warning: Optional[str] = None


class UploadFileResult(BaseModel):
    """Result from parsing an uploaded 3D/CAD file."""
    success: bool
    file_name: str
    file_type: str  # stl, obj, glb, step, dxf, dwg
    error: Optional[str] = None
    warning: Optional[str] = None
    components: List[ComponentInput] = Field(default_factory=list)
    bounding_box_mm: Optional[Dict[str, float]] = None
    units_confirmed: bool = False
    units_assumed: Optional[str] = None


# ─────────────────────────────────────────────
# AI Assistant schemas
# ─────────────────────────────────────────────

class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: Optional[str] = None


class AssistantRequest(BaseModel):
    project_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    page_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Structured context from the current page: route, open tab, visible values, etc."
    )
    history: List[AssistantMessage] = Field(default_factory=list)


class AssistantResponse(BaseModel):
    reply: str
    mode: Literal["ai", "offline"] = "offline"
    fields_cited: List[str] = Field(default_factory=list)
    disclaimer: Optional[str] = None


# ─────────────────────────────────────────────
# Report Schemas
# ─────────────────────────────────────────────

class ReportRequest(BaseModel):
    project_id: str
    alternative_id: str
    format: Literal["pdf", "html", "json"] = "pdf"
    language: Literal["en", "ar"] = "en"


class ExportResult(BaseModel):
    file_path: str
    file_name: str
    format: str
    size_bytes: int
    generated_at: datetime
    is_valid: bool
    validation_notes: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Error Response
# ─────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    field_errors: Optional[Dict[str, List[str]]] = None
