"""
NxtPak AI — All Pydantic schemas (Production Grade).
Strict validation, explicit units everywhere, zero fake data, full provenance tracking.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Literal, Dict, Any
from enum import Enum
from datetime import datetime
import uuid
import math


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
    CAD_EXTRACTED = "CAD_EXTRACTED"
    AI_ESTIMATED = "AI_ESTIMATED"
    DERIVED = "DERIVED"
    OFFICIAL_COMPANY = "OFFICIAL_COMPANY"


class DataLabel(str, Enum):
    USER_ENTERED = "USER ENTERED"
    FETCHED = "FETCHED"
    CAD_EXTRACTED = "CAD EXTRACTED"
    AI_ESTIMATED = "AI ESTIMATED"
    DERIVED = "DERIVED"
    ESTIMATE = "ESTIMATE"
    VERIFIED = "VERIFIED"


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
# Provenance
# ─────────────────────────────────────────────

class Provenance(BaseModel):
    source_name: str
    source_url: Optional[str] = None
    retrieval_date: Optional[str] = None
    source_type: SourceType = SourceType.USER_ENTERED
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_edited: bool = False
    evidence_snippet: Optional[str] = None


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
        return round(self.length * factor, 2), round(self.width * factor, 2), round(self.height * factor, 2)


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
        return all(v is not None and v > 0 for v in [self.length_mm, self.width_mm, self.height_mm])


class ProductInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Product Name")
    brand: str = Field(..., min_length=1, max_length=100, description="Brand name (e.g. Tornado, Toshiba)")
    model: str = Field(..., min_length=1, max_length=100, description="Model Number (e.g. TSF-16W)")
    sku: Optional[str] = Field(None, max_length=100, description="Stock Keeping Unit / Barcode")
    category: Optional[str] = Field(None, max_length=100)
    product_type: Literal[
        "blender", "stand_fan", "ceiling_fan", "washing_machine", "refrigerator",
        "air_conditioner", "tv", "kettle", "microwave", "water_heater", "other",
    ] = Field(default="other", description="Saved product type used to select a parametric model")
    product_type_provenance: Optional[Provenance] = None
    shipping_mode: Optional[Literal["courier_parcel", "ltl_pallet", "full_truck", "container", "ecommerce_marketplace"]] = None
    weight_kg: float = Field(..., gt=0, le=5000, description="Net weight in kg (>0)")
    fragility_class: FragilityClass = Field(..., description="Fragility class (LOW, MEDIUM, HIGH, VERY_HIGH)")
    fragility_note: Optional[str] = Field(None, max_length=500)
    packed_dimensions: DimensionsInput = Field(..., description="Product dimensions L x W x H")
    components: List[ComponentInput] = Field(default_factory=list)
    image_url: Optional[str] = Field(None, max_length=1000)
    images: List[str] = Field(default_factory=list)
    provenance: Optional[Provenance] = None
    notes: Optional[str] = Field(None, max_length=1000)


# ─────────────────────────────────────────────
# Baseline Packaging Schema
# ─────────────────────────────────────────────

class BaselinePackaging(BaseModel):
    carton_outer_length_mm: float = Field(..., gt=0, le=10000, description="Outer length in mm")
    carton_outer_width_mm: float = Field(..., gt=0, le=10000, description="Outer width in mm")
    carton_outer_height_mm: float = Field(..., gt=0, le=10000, description="Outer height in mm")
    board_type: str = Field(..., min_length=1, max_length=100, description="Flute type e.g. B, C, BC double wall")
    board_thickness_mm: float = Field(..., gt=0, le=50, description="Wall thickness in mm")
    carton_cost_per_unit: float = Field(..., ge=0, description="Carton unit cost")
    currency: str = Field(default="EGP", max_length=10)
    units_per_pallet: int = Field(default=24, ge=1, le=10000)
    pallet_type: str = Field(default="Euro Pallet 1200x800", max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    provenance: Optional[Provenance] = None

    @property
    def inner_length_mm(self) -> float:
        return max(1.0, self.carton_outer_length_mm - 2 * self.board_thickness_mm)

    @property
    def inner_width_mm(self) -> float:
        return max(1.0, self.carton_outer_width_mm - 2 * self.board_thickness_mm)

    @property
    def inner_height_mm(self) -> float:
        return max(1.0, self.carton_outer_height_mm - 2 * self.board_thickness_mm)


class PlannedPackaging(BaseModel):
    carton_outer_length_mm: float = Field(..., gt=0, le=10000)
    carton_outer_width_mm: float = Field(..., gt=0, le=10000)
    carton_outer_height_mm: float = Field(..., gt=0, le=10000)
    board_thickness_mm: float = Field(default=4.0, gt=0, le=50)
    notes: Optional[str] = Field(None, max_length=500)
    provenance: Optional[Provenance] = None


# ─────────────────────────────────────────────
# Optimization Config
# ─────────────────────────────────────────────

class OptimizationConfig(BaseModel):
    min_clearance_mm: float = Field(default=15.0, ge=0, le=200)
    standard_clearance_mm: float = Field(default=25.0, ge=0, le=200)
    generous_clearance_mm: float = Field(default=40.0, ge=0, le=200)
    board_thickness_mm: float = Field(default=4.0, ge=1, le=20)
    insert_thickness_mm: float = Field(default=20.0, ge=0, le=100)
    assumption_label: str = "ENGINEERING_ASSUMPTION"


# ─────────────────────────────────────────────
# Project Create & Response
# ─────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    product: ProductInput
    baseline: BaselinePackaging
    planned: Optional[PlannedPackaging] = None
    components: List[ComponentInput] = Field(default_factory=list)
    optimization_config: OptimizationConfig = Field(default_factory=OptimizationConfig)
    language: Literal["en", "ar"] = Field(default="en")

    @model_validator(mode="after")
    def validate_carton_fit(self) -> "ProjectCreate":
        # If disassembled components are provided, the product is packaged in a knocked-down (KD) flat-pack state.
        # Check that individual components fit within the carton's 3D internal envelope and diagonal.
        comps = self.components or (self.product and self.product.components) or []
        if comps:
            b_l = self.baseline.carton_outer_length_mm
            b_w = self.baseline.carton_outer_width_mm
            b_h = self.baseline.carton_outer_height_mm
            b_diag = math.sqrt(b_l**2 + b_w**2 + b_h**2)
            b_min = min(b_l, b_w, b_h)
            b_vol = b_l * b_w * b_h

            for comp in comps:
                if comp.has_dimensions:
                    c_l = comp.length_mm or 0
                    c_w = comp.width_mm or 0
                    c_h = comp.height_mm or 0
                    c_max = max(c_l, c_w, c_h)
                    c_min = min(c_l, c_w, c_h)
                    c_vol = c_l * c_w * c_h

                    if c_max > b_diag:
                        raise ValueError(
                            f"Component '{comp.name}' length ({c_max} mm) exceeds carton 3D diagonal ({b_diag:.1f} mm)."
                        )
                    if c_min > b_min:
                        raise ValueError(
                            f"Component '{comp.name}' minimum thickness ({c_min} mm) exceeds carton minimum dimension ({b_min} mm)."
                        )
                    if c_vol > b_vol:
                        raise ValueError(
                            f"Component '{comp.name}' volume exceeds total carton volume."
                        )
            return self

        p_l, p_w, p_h = self.product.packed_dimensions.to_mm()
        b_l = self.baseline.carton_outer_length_mm
        b_w = self.baseline.carton_outer_width_mm
        b_h = self.baseline.carton_outer_height_mm

        # Physical sanity check: carton must be physically larger than product
        if b_l <= p_l or b_w <= p_w or b_h <= p_h:
            # Check other orientations before raising
            p_dims_sorted = sorted([p_l, p_w, p_h])
            b_dims_sorted = sorted([b_l, b_w, b_h])
            if any(p > b for p, b in zip(p_dims_sorted, b_dims_sorted)):
                raise ValueError(
                    f"Baseline carton ({b_l}x{b_w}x{b_h} mm) is smaller than product dimensions ({p_l}x{p_w}x{p_h} mm) in at least one orientation. If product is shipped disassembled, include components list."
                )
        return self


class ProjectResponse(BaseModel):
    project_id: str
    name: str
    brand: str
    model_number: str
    sku: Optional[str]
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    language: str

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# McKee Formula & Palletization
# ─────────────────────────────────────────────

class McKeeCalculation(BaseModel):
    ect_kn_m: float = Field(description="Edge Crush Test of corrugated board (kN/m)")
    board_thickness_mm: float = Field(description="Caliper / thickness of corrugated board (mm)")
    box_perimeter_mm: float = Field(description="Perimeter of box 2*(L + W) (mm)")
    bct_newtons: float = Field(description="Predicted Box Compression Strength (N)")
    bct_kgf: float = Field(description="Predicted Box Compression Strength (kgf)")
    safety_factor: float = Field(default=4.5, description="Safety factor for humidity/stacking (typically 4.0-5.0)")
    max_safe_stack_load_kg: float = Field(description="Safe bottom box load limit (kg)")
    estimated_max_stack_layers: int = Field(description="Maximum allowable box stack layers")
    formula_display: str = "BCT = 5.876 × ECT × √(Perimeter × Thickness)"


class PalletizationResult(BaseModel):
    pallet_type: str = "Euro Pallet (1200 x 800 mm)"
    pallet_length_mm: float = 1200.0
    pallet_width_mm: float = 800.0
    max_pallet_height_mm: float = 1800.0
    cartons_per_layer: int
    layers_count: int
    total_cartons_per_pallet: int
    pallet_area_utilization_pct: float
    total_pallet_weight_kg: float
    stacking_pattern: str = "Interlocking / Column"


# ─────────────────────────────────────────────
# Packaging Alternative Schemas
# ─────────────────────────────────────────────

class MaterialUsage(BaseModel):
    carton_board_area_cm2: float
    carton_board_volume_cm3: float
    insert_volume_cm3: float
    total_material_volume_cm3: float
    corrugated_board_weight_kg: float
    co2_footprint_kg: float
    label: str = "CALCULATED"
    formula_notes: str


class CostBreakdown(BaseModel):
    carton_cost: float
    insert_cost: float
    total_cost: float
    currency: str = "EGP"
    cost_status: str = "CALCULATED"


class SavingsMetrics(BaseModel):
    volume_utilization: float
    volume_utilization_pct: float
    volume_utilization_formula: str = "product_volume_mm³ / packaging_internal_volume_mm³"
    material_saved_pct: float
    material_saved_cm3: float
    material_savings_formula: str = "(baseline_area - proposed_area) / baseline_area × 100"
    cost_saved: float
    cost_saved_pct: float
    co2_saved_kg: float
    currency: str = "EGP"
    baseline_available: bool = True
    savings_status: str = "CALCULATED"
    inputs_used: List[str] = Field(default_factory=list)


class PackagingAlternative(BaseModel):
    alternative_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    rank: AlternativeRank

    # Outer & Inner dimensions
    outer_length_mm: float
    outer_width_mm: float
    outer_height_mm: float
    board_thickness_mm: float
    inner_length_mm: float
    inner_width_mm: float
    inner_height_mm: float

    # Clearances
    clearance_length_mm: float
    clearance_width_mm: float
    clearance_height_mm: float
    clearance_label: str = "ENGINEERING_ASSUMPTION"

    # Cushion / insert
    insert_thickness_mm: float
    insert_description: str

    # Metrics
    material_usage: MaterialUsage
    savings: SavingsMetrics
    cost: CostBreakdown
    mckee_compression: McKeeCalculation
    palletization: PalletizationResult

    ranking_score: float
    ranking_criteria: Dict[str, Any]
    assumptions: List[str]
    standards_summary: Optional[Dict[str, Any]] = None


class OptimizationResult(BaseModel):
    project_id: str
    product_name: str
    product_volume_mm3: float
    baseline_outer_volume_liters: float
    alternatives: List[PackagingAlternative]
    recommended: PackagingAlternative
    baseline_included: bool = True
    calculation_notes: List[str]
    assumptions: List[str]
    result_warning: str = (
        "Calculations are deterministic engineering models (including McKee equation). "
        "Physical laboratory testing is required before production."
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
    clause: Optional[str] = None
    organization: str = "ISO"
    parameters_used: Dict[str, Any] = Field(default_factory=dict)
    sub_check_results: List[Dict[str, Any]] = Field(default_factory=list)
    what_is_still_required: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None


class StandardsEvaluationResult(BaseModel):
    project_id: str
    alternative_id: str
    evaluated_at: datetime
    registry_version: str
    registry_source: str = "NxtPak ISO registry v1"
    evaluation_statement: str = (
        "Evaluated against: NxtPak ISO registry v1 (see source list). No company-specific requirements loaded."
    )
    company_requirements_loaded: bool = False
    results: List[StandardsCheckResult]
    programmatic_pass_count: int
    programmatic_fail_count: int
    not_configured_count: int
    not_verifiable_count: int
    needs_review_count: int
    disclaimer: str = (
        "A software PASS is never proof of ISO certification. "
        "Physical-test standards require laboratory execution."
    )


# ─────────────────────────────────────────────
# Dynamic Product Search & Candidate Picker
# ─────────────────────────────────────────────

class ProductSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=100, description="Model number, product name, or SKU")
    brand: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    product_url: Optional[str] = Field(None, max_length=500)
    site_region: Optional[str] = Field("elarabygroup.com (EG)", max_length=100)


class SpecStatus(str, Enum):
    VERIFIED = "verified"
    FOUND_SINGLE_SOURCE = "found_single_source"
    USER = "user"
    CALCULATED = "calculated"
    AI_ESTIMATED = "ai_estimated"
    MISSING = "missing"


class SourceEvidence(BaseModel):
    source_name: str
    source_url: str
    snippet: str
    fetched_at: str
    confidence: float
    is_official: bool = False


class ProductSpecField(BaseModel):
    value: Optional[Any] = None
    unit: Optional[str] = None
    status: SpecStatus = SpecStatus.MISSING
    sources: List[SourceEvidence] = Field(default_factory=list)
    conflict_values: Optional[List[Dict[str, Any]]] = None


class ComponentSpec(BaseModel):
    name: str
    part_number: Optional[str] = None
    length_mm: float
    width_mm: float
    height_mm: float
    weight_kg: float
    quantity: int = 1
    material: Optional[str] = None
    fragile: bool = False
    notes: Optional[str] = None


class ProductCandidate(BaseModel):
    candidate_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    brand: str
    model: str
    sku: Optional[str] = None
    category: Optional[str] = None
    net_weight_kg: Optional[float] = None
    gross_weight_kg: Optional[float] = None
    dimensions_mm: Optional[Dict[str, float]] = None
    carton_dimensions_mm: Optional[Dict[str, float]] = None
    image_url: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    datasheet_url: Optional[str] = None
    source_url: str
    source_type: SourceType = SourceType.PUBLIC_RETAIL
    confidence_score: float = 0.85
    specs_table: Dict[str, str] = Field(default_factory=dict)
    components: List[ComponentSpec] = Field(default_factory=list)
    sources_checked: List[Dict[str, Any]] = Field(default_factory=list)
    packed_dimensions_available: bool = True
    not_found_message: Optional[str] = None
    spec_fields: Optional[Dict[str, ProductSpecField]] = None
    notes: Optional[str] = None
    provenance: Provenance


class CandidateSpecsResponse(BaseModel):
    candidate_id: str
    name: str
    brand: str
    model: str
    sku: Optional[str] = None
    category: Optional[str] = None
    product_dimensions: ProductSpecField
    carton_dimensions: ProductSpecField
    net_weight: ProductSpecField
    gross_weight: ProductSpecField
    components: List[ComponentSpec] = Field(default_factory=list)
    color: Optional[str] = None
    power_voltage: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    datasheet_url: Optional[str] = None
    sources_checked: List[Dict[str, Any]] = Field(default_factory=list)
    summary_bar: Dict[str, Any] = Field(default_factory=dict)
    packed_dimensions_available: bool = True
    not_found_message: Optional[str] = None
    similar_products_for_estimate: List[Dict[str, Any]] = Field(default_factory=list)


class ProductSearchResponse(BaseModel):
    query: str
    normalized_query: str
    candidates: List[ProductCandidate]
    exact_match: bool
    did_you_mean: Optional[str] = None
    cached: bool = False
    source_url_used: Optional[str] = None
    status_message: str


# ─────────────────────────────────────────────
# Upload 3D/CAD File Result
# ─────────────────────────────────────────────

class UploadFileResult(BaseModel):
    success: bool
    file_name: str
    file_type: str
    error: Optional[str] = None
    warning: Optional[str] = None
    components: List[ComponentInput] = Field(default_factory=list)
    bounding_box_mm: Optional[Dict[str, float]] = None
    volume_cm3: Optional[float] = None
    surface_area_cm2: Optional[float] = None
    center_of_mass: Optional[List[float]] = None
    is_watertight: Optional[bool] = None
    units_assumed: str = "mm"
    provenance: Optional[Provenance] = None


# ─────────────────────────────────────────────
# Settings Management
# ─────────────────────────────────────────────

class AdminSettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    default_clearance_mm: Optional[float] = Field(None, ge=5.0, le=100.0)
    default_board_cost_per_m2: Optional[float] = Field(None, ge=0.1, le=500.0)
    currency: Optional[str] = Field(None, max_length=10)


class AdminSettingsResponse(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str = "claude-3-5-sonnet-20241022"
    llm_configured: bool = False
    default_clearance_mm: float = 20.0
    default_board_cost_per_m2: float = 25.0
    currency: str = "EGP"


# ─────────────────────────────────────────────
# AI Assistant Schemas
# ─────────────────────────────────────────────

class AssistantMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: Optional[str] = None


class AssistantRequest(BaseModel):
    project_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=4000)
    page_context: Optional[Dict[str, Any]] = None
    history: List[AssistantMessage] = Field(default_factory=list)


class AssistantResponse(BaseModel):
    reply: str
    mode: Literal["ai", "offline"]
    provider_name: Optional[str] = None
    model_name: Optional[str] = None
    tools_called: List[str] = Field(default_factory=list)
    fields_cited: List[str] = Field(default_factory=list)
    disclaimer: Optional[str] = None


# ─────────────────────────────────────────────
# Report Schemas
# ─────────────────────────────────────────────

class ReportRequest(BaseModel):
    project_id: str
    alternative_id: str
    format: Literal["pdf", "html", "json", "dxf"] = "pdf"
    language: Literal["en", "ar"] = "en"


class ExportResult(BaseModel):
    file_path: str
    file_name: str
    format: str
    size_bytes: int
    generated_at: datetime
    is_valid: bool
    validation_notes: List[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    field_errors: Optional[Dict[str, List[str]]] = None
