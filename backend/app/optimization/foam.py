"""Deterministic cushioning calculations using explicitly sourced supplier curves."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


NO_CURVE_WARNING = (
    "No cushion curve for this material — estimate only, lab validation required"
)


class CushionCurvePoint(BaseModel):
    static_stress_kpa: float = Field(gt=0)
    peak_deceleration_g: float = Field(gt=0)


class CushionCurve(BaseModel):
    thickness_mm: float = Field(gt=0)
    drop_height_mm: float = Field(gt=0)
    points: list[CushionCurvePoint] = Field(min_length=2)

    @model_validator(mode="after")
    def stress_points_are_ordered(self) -> "CushionCurve":
        stresses = [point.static_stress_kpa for point in self.points]
        if stresses != sorted(set(stresses)):
            raise ValueError("Cushion curve stresses must be unique and increasing.")
        return self


class CushionMaterial(BaseModel):
    material_id: str
    name: str
    material_type: str
    density_kg_m3: float | None = Field(default=None, gt=0)
    available_thicknesses_mm: list[float] = Field(default_factory=list)
    cost_per_m3: float | None = Field(default=None, ge=0)
    cost_per_kg: float | None = Field(default=None, ge=0)
    sustainability_note: str | None = None
    temperature_humidity_notes: str | None = None
    cushion_curves: list[CushionCurve] = Field(default_factory=list)
    source_name: str | None = None
    source_url: str | None = None
    retrieval_date: str | None = None
    is_edited: bool = False
    enabled: bool = True

    @model_validator(mode="after")
    def sourced_curves(self) -> "CushionMaterial":
        if self.cushion_curves and not all((self.source_name, self.source_url, self.retrieval_date)):
            raise ValueError("Supplier curves require source name, source URL, and retrieval date.")
        return self


class FoamSupportInput(BaseModel):
    name: str
    carried_weight_kg: float = Field(gt=0)
    bearing_area_mm2: float = Field(gt=0)


class FoamSupportResult(BaseModel):
    name: str
    carried_weight_kg: float
    bearing_area_mm2: float
    static_stress_kpa: float


class FoamDesignResult(BaseModel):
    material_id: str | None = None
    material_name: str | None = None
    status: Literal["CURVE_EVALUATED", "NO_CURVE", "INVALID_INPUT"]
    calculation_label: str = "Calculation, to be validated in a lab"
    safety_factor: float | None = None
    drop_height_mm: float | None = None
    fragility_limit_g: float | None = None
    supports: list[FoamSupportResult] = Field(default_factory=list)
    selected_thickness_mm: float | None = None
    estimated_peak_deceleration_g: float | None = None
    protection_margin_g: float | None = None
    foam_volume_mm3: float | None = None
    foam_weight_kg: float | None = None
    foam_cost: float | None = None
    warnings: list[str] = Field(default_factory=list)


def _interpolate_peak_g(curve: CushionCurve, stress_kpa: float) -> float | None:
    points = curve.points
    if stress_kpa < points[0].static_stress_kpa or stress_kpa > points[-1].static_stress_kpa:
        return None
    for lower, upper in zip(points, points[1:]):
        if lower.static_stress_kpa <= stress_kpa <= upper.static_stress_kpa:
            ratio = (stress_kpa - lower.static_stress_kpa) / (
                upper.static_stress_kpa - lower.static_stress_kpa
            )
            return lower.peak_deceleration_g + ratio * (
                upper.peak_deceleration_g - lower.peak_deceleration_g
            )
    return None


def calculate_foam_design(
    *,
    material: CushionMaterial | None,
    supports: list[FoamSupportInput],
    drop_height_mm: float,
    fragility_limit_g: float,
    safety_factor: float,
    product_dimensions_mm: dict[str, float] | None = None,
    requested_max_thickness_mm: float | None = None,
) -> FoamDesignResult:
    """Choose the thinnest curve-backed foam that meets the explicit G limit."""
    if drop_height_mm <= 0 or fragility_limit_g <= 0 or safety_factor < 1:
        raise ValueError("Drop height and fragility limit must be positive; safety factor must be at least 1.")
    if not supports:
        raise ValueError("At least one measured foam support is required.")

    support_results = [
        FoamSupportResult(
            name=support.name,
            carried_weight_kg=support.carried_weight_kg,
            bearing_area_mm2=support.bearing_area_mm2,
            static_stress_kpa=(
                support.carried_weight_kg * 9.80665 / (support.bearing_area_mm2 / 1_000_000)
            ) / 1000,
        )
        for support in supports
    ]

    curves = [
        curve for curve in (material.cushion_curves if material and material.enabled else [])
        if curve.drop_height_mm == drop_height_mm
    ]
    if not curves:
        return FoamDesignResult(
            material_id=material.material_id if material else None,
            material_name=material.name if material else None,
            status="NO_CURVE",
            safety_factor=safety_factor,
            drop_height_mm=drop_height_mm,
            fragility_limit_g=fragility_limit_g,
            supports=support_results,
            warnings=[NO_CURVE_WARNING],
        )

    candidates: list[tuple[float, float]] = []
    for curve in curves:
        support_g_values = [
            _interpolate_peak_g(curve, support.static_stress_kpa)
            for support in support_results
        ]
        if all(value is not None for value in support_g_values):
            peak_g = max(value for value in support_g_values if value is not None)
            if peak_g * safety_factor <= fragility_limit_g:
                candidates.append((curve.thickness_mm, peak_g))

    if not candidates:
        return FoamDesignResult(
            material_id=material.material_id if material else None,
            material_name=material.name if material else None,
            status="CURVE_EVALUATED",
            safety_factor=safety_factor,
            drop_height_mm=drop_height_mm,
            fragility_limit_g=fragility_limit_g,
            supports=support_results,
            warnings=["No supplied curve at this drop height and loading meets the entered fragility limit and safety factor."],
        )

    requested_warning: list[str] = []
    eligible = candidates
    if requested_max_thickness_mm is not None:
        eligible = [candidate for candidate in candidates if candidate[0] <= requested_max_thickness_mm]
        if not eligible:
            eligible = candidates
            nearest_valid = min(candidates, key=lambda candidate: candidate[0])[0]
            requested_warning.append(
                f"Requested {requested_max_thickness_mm:g} mm does not meet the curve-based protection check; nearest valid thickness is {nearest_valid:g} mm."
            )
    thickness, peak_g = min(eligible, key=lambda candidate: candidate[0])
    volume_mm3 = None
    weight_kg = None
    cost = None
    if product_dimensions_mm and all(product_dimensions_mm.get(axis, 0) > 0 for axis in ("length", "width", "height")):
        length = product_dimensions_mm["length"]
        width = product_dimensions_mm["width"]
        height = product_dimensions_mm["height"]
        volume_mm3 = (
            2 * thickness * height * width
            + 2 * thickness * height * length
            + 2 * thickness * (length + 2 * thickness) * (width + 2 * thickness)
        )
        volume_m3 = volume_mm3 / 1_000_000_000
        if material and material.density_kg_m3 is not None:
            weight_kg = volume_m3 * material.density_kg_m3
            if material.cost_per_kg is not None:
                cost = weight_kg * material.cost_per_kg
        if material and material.cost_per_m3 is not None:
            cost = volume_m3 * material.cost_per_m3

    warnings = ["Estimated from supplier curve; physical cushioning validation is required.", *requested_warning]
    if material and material.density_kg_m3 is None:
        warnings.append("Foam weight is not available because material density is not configured.")
    if material and material.cost_per_kg is None and material.cost_per_m3 is None:
        warnings.append("Foam cost is not available because no material cost is configured.")
    return FoamDesignResult(
        material_id=material.material_id if material else None,
        material_name=material.name if material else None,
        status="CURVE_EVALUATED",
        safety_factor=safety_factor,
        drop_height_mm=drop_height_mm,
        fragility_limit_g=fragility_limit_g,
        supports=support_results,
        selected_thickness_mm=thickness,
        estimated_peak_deceleration_g=peak_g,
        protection_margin_g=round(fragility_limit_g - peak_g * safety_factor, 4),
        foam_volume_mm3=volume_mm3,
        foam_weight_kg=weight_kg,
        foam_cost=cost,
        warnings=warnings,
    )


DEFAULT_MATERIAL_NAMES = (
    ("epe", "Polyethylene foam (EPE)", "foam"),
    ("eps", "Expanded polystyrene (EPS)", "foam"),
    ("epp", "Expanded polypropylene (EPP)", "foam"),
    ("pu_die_cut", "Polyurethane foam (die-cut)", "foam"),
    ("pu_in_place", "Polyurethane foam (foam-in-place)", "foam"),
    ("moulded_pulp", "Moulded pulp", "fibre"),
    ("corrugated_inserts", "Corrugated inserts / pads / dividers", "fibre"),
    ("paper_honeycomb", "Paper honeycomb", "fibre"),
    ("air_pillows", "Air cushion pillows", "air"),
    ("kraft_void_fill", "Kraft paper void fill", "fibre"),
)


def empty_material_library() -> list[CushionMaterial]:
    """Return named, editable material records without invented properties or curves."""
    return [
        CushionMaterial(
            material_id=material_id,
            name=name,
            material_type=material_type,
            enabled=False,
        )
        for material_id, name, material_type in DEFAULT_MATERIAL_NAMES
    ]


def unconfigured_foam_design() -> FoamDesignResult:
    return FoamDesignResult(
        status="NO_CURVE",
        warnings=[NO_CURVE_WARNING, "Enter a measured fragility limit, drop height, support areas, and supplier curve to calculate thickness."],
    )
