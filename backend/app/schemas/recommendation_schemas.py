"""
Pydantic schemas for the AI Recommendation Engine (Hybrid Verifiable).
Every metric traces to deterministic engineering formulas (McKee, Euro Pallet, Clearances).
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


class PackoutStep(BaseModel):
    step_number: int
    title: str
    description: str
    component_involved: str


class RejectedCandidate(BaseModel):
    name: str
    carton_length_mm: float
    carton_width_mm: float
    carton_height_mm: float
    failed_check: str
    explanation: str


class RecommendedCandidate(BaseModel):
    candidate_id: str
    name: str
    badge: str  # e.g., "Recommended", "Lowest Cost", "Max Protection", "Pallet Efficient"
    is_recommended: bool = False

    # Dimensions & Board
    carton_length_mm: float
    carton_width_mm: float
    carton_height_mm: float
    board_grade: str
    board_thickness_mm: float
    ect_kn_m: float
    insert_type: str
    insert_material: str
    cushion_thickness_mm: float
    orientation: str
    units_per_carton: int = 1

    # Pallet Logistics (Euro Pallet 1200x800)
    pallet_type: str = "Euro Pallet (1200 x 800 mm)"
    cartons_per_layer: int
    layer_count: int
    units_per_pallet: int
    pallet_utilization_pct: float
    pallet_overhang_mm: float
    stacking_height_mm: float

    # Engineering Calculations
    bct_newtons: float
    bct_kgf: float
    stacking_load_kgf: float
    safety_factor: float
    box_perimeter_mm: float
    carton_board_area_m2: float

    # Savings vs Baseline
    material_savings_pct: float
    volume_savings_pct: float
    cost_per_unit: Optional[float] = None
    cost_savings_pct: Optional[float] = None
    cost_savings_per_1000_units: Optional[float] = None
    currency: str = "EGP"

    # Exploded Packout Sequence
    packout_steps: List[PackoutStep] = []

    # ISO Standards Constraint Notes (per candidate)
    # Populated by recommendation engine from get_recommendation_constraints()
    # Each note cites the standard, rule, value, and ENGINEERING_ASSUMPTION label.
    iso_constraint_notes: List[str] = []


class RecommendationFeedback(BaseModel):
    status: Literal["accepted", "rejected"]
    reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RecommendationRun(BaseModel):
    run_id: str
    project_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    model_name: str
    is_ai_reasoned: bool = True  # True if LLM reasoning was used; False if calculated deterministically

    # Active recommendation + alternatives
    recommended: RecommendedCandidate
    alternatives: List[RecommendedCandidate] = []
    rejected_candidates: List[RejectedCandidate] = []

    # AI Reasoning outputs (grounded in candidate calculations)
    explanation: str
    confidence_level: Literal["High", "Medium", "Low"]
    confidence_reason: str
    assumptions: List[str] = []
    missing_data: List[str] = []
    test_plan: List[str] = []

    # Locked values & conversational refinement history
    locked_fields: Dict[str, Any] = {}
    refinement_history: List[Dict[str, Any]] = []
    user_feedback: Optional[RecommendationFeedback] = None


class RefinementRequest(BaseModel):
    prompt: str  # e.g. "make it cheaper", "I only have 5-ply board", "must fit 8 per pallet layer"
    locked_fields: Optional[Dict[str, Any]] = None
