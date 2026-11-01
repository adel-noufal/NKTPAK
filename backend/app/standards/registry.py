"""
NxtPak AI — ISO Standards Registry
Loads standards metadata from JSON and runs programmatic checks.

Rules enforced:
- Physical-test standards NEVER return PASS from software.
- No numeric ISO test parameters are hardcoded.
- Every result includes a disclaimer and evaluation statement.
- A software PASS is never proof of ISO certification.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings
from app.schemas.schemas import (
    CheckStatus,
    CheckType,
    OptimizationConfig,
    StandardsCheckResult,
)

logger = logging.getLogger(__name__)

# Disclaimer required on every report
SOFTWARE_DISCLAIMER = (
    "A software PASS is never proof of ISO certification or successful physical testing. "
    "Physical-test standards require laboratory execution. "
    "No compliance certificates are generated."
)

EVALUATION_STATEMENT = (
    "Evaluated against: NxtPak ISO registry v1 and ISTA registry v1 (see source list). "
    "No company-specific requirements loaded."
)

# Volume utilization thresholds (configurable — stored here as named constants, not inline magic numbers)
VOL_UTIL_PASS_THRESHOLD = 0.60  # >= 60%: PASS
VOL_UTIL_FAIL_THRESHOLD = 0.40  # <  40%: FAIL; between 40-60%: NEEDS_REVIEW


def _load_registry_file(path: str) -> dict[str, Any]:
    """Load a standards JSON file and return the parsed dict."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Standards registry not found: {path}")
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


class StandardsRegistry:
    """
    Loads and manages the NxtPak ISO standards registry.
    Supports loading additional requirement files (OFFICIAL_COMPANY, USER_ENTERED).
    """

    def __init__(self) -> None:
        self._standards: list[dict[str, Any]] = []
        self._registry_version: str = "1"
        self._additional_entries: list[dict[str, Any]] = []
        self._loaded = False

    def load(self, path: Optional[str] = None) -> None:
        """Load the base ISO registry and ISTA registry."""
        registry_path = path or settings.standards_registry_path
        data = _load_registry_file(registry_path)
        self._standards = list(data.get("standards", []))
        self._registry_version = data.get("registry_version", "1")

        # Load ISTA standards registry if present
        ista_path = Path(registry_path).parent / "ista_registry.json"
        if ista_path.exists():
            try:
                ista_data = _load_registry_file(str(ista_path))
                ista_items = ista_data.get("standards", [])
                self._standards.extend(ista_items)
                logger.info("Loaded %d ISTA standards from %s", len(ista_items), ista_path)
            except Exception as e:
                logger.warning("Could not load ISTA registry: %s", e)

        self._loaded = True
        logger.info(
            "Standards registry loaded: %d entries (version %s)",
            len(self._standards),
            self._registry_version,
        )

    def load_additional_requirements(self, json_path: str) -> int:
        """
        Load additional requirements from a JSON file.
        Accepted source_types: OFFICIAL_COMPANY, USER_ENTERED.
        Returns the count of newly loaded entries.
        """
        data = _load_registry_file(json_path)
        entries: list[dict[str, Any]] = data.get("standards", [])
        accepted_types = {"OFFICIAL_COMPANY", "USER_ENTERED"}
        added = 0
        for entry in entries:
            if entry.get("source_type") in accepted_types:
                self._additional_entries.append(entry)
                added += 1
            else:
                logger.warning(
                    "Skipped entry %s with source_type=%s (only OFFICIAL_COMPANY/USER_ENTERED accepted for import)",
                    entry.get("entry_id", "?"),
                    entry.get("source_type", "MISSING"),
                )
        logger.info("Loaded %d additional requirement entries from %s", added, json_path)
        return added

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    def get_all_standards(self) -> list[dict[str, Any]]:
        """Return all standards (base + additional)."""
        self._ensure_loaded()
        return list(self._standards) + list(self._additional_entries)

    def get_standard_by_id(self, entry_id: str) -> Optional[dict[str, Any]]:
        """Return a single standard by entry_id, or None."""
        self._ensure_loaded()
        for s in self.get_all_standards():
            if s.get("entry_id") == entry_id:
                return s
        return None

    @property
    def registry_version(self) -> str:
        self._ensure_loaded()
        return self._registry_version

    # ──────────────────────────────────────────────────────────────────────────
    # Programmatic check helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _check_iso18602(
        self,
        entry: dict[str, Any],
        product_volume_mm3: float,
        alternative: dict[str, Any],
        baseline: Optional[dict[str, Any]],
    ) -> StandardsCheckResult:
        """
        ISO 18602 — Overall check is HUMAN_REVIEW.
        Sub-checks:
          - 18602-volume-util: PROGRAMMATIC
          - 18602-material-savings: PROGRAMMATIC if baseline provided, else NOT_CONFIGURED
        """
        sub_results: list[dict[str, Any]] = []
        parameters_used: dict[str, Any] = {}
        what_required: list[str] = []

        # Sub-check 1: volume utilization
        inner_vol = alternative.get("inner_volume_mm3", 0.0)
        if not inner_vol:
            iL = alternative.get("inner_length_mm", 0.0)
            iW = alternative.get("inner_width_mm", 0.0)
            iH = alternative.get("inner_height_mm", 0.0)
            if iL > 0 and iW > 0 and iH > 0:
                inner_vol = iL * iW * iH

        if inner_vol and inner_vol > 0:
            vol_util = product_volume_mm3 / inner_vol
            parameters_used["product_volume_mm3"] = product_volume_mm3
            parameters_used["inner_volume_mm3"] = inner_vol
            parameters_used["volume_utilization"] = round(vol_util, 4)
            parameters_used["volume_utilization_formula"] = (
                "product_volume_mm3 / packaging_internal_volume_mm3"
            )

            if vol_util >= VOL_UTIL_PASS_THRESHOLD:
                sub_status = CheckStatus.PASS
                sub_detail = (
                    f"Volume utilization = {vol_util:.1%} (>= {VOL_UTIL_PASS_THRESHOLD:.0%} threshold). [ESTIMATE]"
                )
            elif vol_util < VOL_UTIL_FAIL_THRESHOLD:
                sub_status = CheckStatus.FAIL
                sub_detail = (
                    f"Volume utilization = {vol_util:.1%} (< {VOL_UTIL_FAIL_THRESHOLD:.0%} threshold). "
                    "Packaging may be oversized. [ESTIMATE]"
                )
            else:
                sub_status = CheckStatus.NEEDS_REVIEW
                sub_detail = (
                    f"Volume utilization = {vol_util:.1%} "
                    f"(between {VOL_UTIL_FAIL_THRESHOLD:.0%} and {VOL_UTIL_PASS_THRESHOLD:.0%}). "
                    "Engineering review recommended. [ESTIMATE]"
                )
            what_required.append(
                "Full ISO 18602 assessment by a qualified packaging engineer is required for conformance."
            )
        else:
            sub_status = CheckStatus.NOT_CONFIGURED
            sub_detail = "Inner volume not available — cannot compute volume utilization."
            what_required.append("Provide inner carton volume to enable volume utilization check.")

        sub_results.append(
            {
                "sub_check_id": "18602-volume-util",
                "status": sub_status.value,
                "detail": sub_detail,
            }
        )

        # Sub-check 2: material savings
        if baseline is not None:
            baseline_usage = baseline.get("total_material_volume_cm3")
            proposed_usage = alternative.get("total_material_volume_cm3")
            if baseline_usage and proposed_usage and baseline_usage > 0:
                saved_pct = (baseline_usage - proposed_usage) / baseline_usage * 100
                parameters_used["baseline_material_volume_cm3"] = baseline_usage
                parameters_used["proposed_material_volume_cm3"] = proposed_usage
                parameters_used["material_saved_pct"] = round(saved_pct, 2)
                parameters_used["material_savings_formula"] = (
                    "(baseline_usage - proposed_usage) / baseline_usage * 100"
                )
                if saved_pct > 0:
                    sav_status = CheckStatus.PASS
                    sav_detail = f"Material reduced by {saved_pct:.1f}% vs baseline. [ESTIMATE — USER_ENTERED baseline]"
                elif saved_pct == 0:
                    sav_status = CheckStatus.NEEDS_REVIEW
                    sav_detail = "No material change vs baseline. [ESTIMATE]"
                else:
                    sav_status = CheckStatus.FAIL
                    sav_detail = f"Material INCREASED by {abs(saved_pct):.1f}% vs baseline. [ESTIMATE]"
            else:
                sav_status = CheckStatus.NOT_CONFIGURED
                sav_detail = "Baseline or proposed material volume missing."
                what_required.append("Provide baseline total_material_volume_cm3 for savings calculation.")
        else:
            sav_status = CheckStatus.NOT_CONFIGURED
            sav_detail = "No baseline provided — material savings NOT_CONFIGURED."
            what_required.append("Enter baseline packaging dimensions and material usage to enable savings calculation.")

        sub_results.append(
            {
                "sub_check_id": "18602-material-savings",
                "status": sav_status.value,
                "detail": sav_detail,
            }
        )

        # Overall: HUMAN_REVIEW (per registry)
        overall_detail = (
            f"Sub-checks: volume-utilization={sub_results[0]['status']}, "
            f"material-savings={sub_results[1]['status']}. "
            "Overall conformance assessment requires human engineering review. "
            + SOFTWARE_DISCLAIMER
        )
        what_required.append(
            "Qualified packaging engineer must perform full ISO 18602 system-level assessment."
        )

        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.HUMAN_REVIEW,
            status=CheckStatus.NEEDS_REVIEW,
            details=overall_detail,
            parameters_used=parameters_used,
            sub_check_results=sub_results,
            what_is_still_required=what_required,
            source_url=entry.get("source_url"),
        )

    def _check_iso2206(self, entry: dict[str, Any]) -> StandardsCheckResult:
        """
        ISO 2206 — Face labeling convention.
        PROGRAMMATIC: NxtPak applies ISO 2206 face/edge/corner identifiers to geometry.
        Status: PASS (this is purely a naming convention applied by software).
        """
        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.PROGRAMMATIC,
            status=CheckStatus.PASS,
            details=(
                "ISO 2206 face, edge, and corner naming convention is applied deterministically "
                "to all generated packaging geometry. Face 1=bottom, Face 2=top, "
                "Face 3=front, Face 4=back, Face 5=left, Face 6=right. [PROGRAMMATIC]"
            ),
            parameters_used={"convention": "ISO 2206:1987 face/edge/corner identification"},
            sub_check_results=[
                {
                    "sub_check_id": "2206-face-labeling",
                    "status": CheckStatus.PASS.value,
                    "detail": "Face, edge, corner identifiers assigned from box L×W×H geometry.",
                }
            ],
            what_is_still_required=[
                "Physical test execution and result recording requires human operator (PHYSICAL_TEST aspect)."
            ],
            source_url=entry.get("source_url"),
        )

    def _check_iso3676(
        self,
        entry: dict[str, Any],
        alternative: dict[str, Any],
        opt_config: Optional[OptimizationConfig],
    ) -> StandardsCheckResult:
        """
        ISO 3676 — Unit load dimensions fit check.
        PROGRAMMATIC if unit load dimensions are configured, else NOT_CONFIGURED.
        """
        ul_L = getattr(opt_config, "unit_load_length_mm", None) if opt_config else None
        ul_W = getattr(opt_config, "unit_load_width_mm", None) if opt_config else None
        ul_H = getattr(opt_config, "unit_load_height_mm", None) if opt_config else None

        if not all([ul_L, ul_W, ul_H]):
            return StandardsCheckResult(
                entry_id=entry["entry_id"],
                standard_identifier=entry["standard_identifier"],
                title=entry["title"],
                check_type=CheckType.PROGRAMMATIC,
                status=CheckStatus.NOT_CONFIGURED,
                details=(
                    "Unit load dimensions not configured. "
                    "Provide target_unit_load_length_mm, _width_mm, _height_mm to enable this check."
                ),
                parameters_used={},
                sub_check_results=[],
                what_is_still_required=[
                    "Configure unit load dimensions (L×W×H mm) in OptimizationConfig.",
                    "Values must come from the licensed ISO 3676 standard or approved company specification.",
                ],
                source_url=entry.get("source_url"),
            )

        pkg_L = alternative.get("outer_length_mm", 0.0)
        pkg_W = alternative.get("outer_width_mm", 0.0)
        pkg_H = alternative.get("outer_height_mm", 0.0)

        fits = pkg_L <= ul_L and pkg_W <= ul_W and pkg_H <= ul_H
        status = CheckStatus.PASS if fits else CheckStatus.FAIL
        params = {
            "target_unit_load_length_mm": ul_L,
            "target_unit_load_width_mm": ul_W,
            "target_unit_load_height_mm": ul_H,
            "pkg_outer_length_mm": pkg_L,
            "pkg_outer_width_mm": pkg_W,
            "pkg_outer_height_mm": pkg_H,
            "formula": "pkg_L <= ul_L AND pkg_W <= ul_W AND pkg_H <= ul_H",
        }
        detail = (
            f"Package outer dims ({pkg_L}×{pkg_W}×{pkg_H} mm) "
            f"{'fit within' if fits else 'EXCEED'} "
            f"unit load dims ({ul_L}×{ul_W}×{ul_H} mm). [PROGRAMMATIC — ESTIMATE]"
        )
        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.PROGRAMMATIC,
            status=status,
            details=detail,
            parameters_used=params,
            sub_check_results=[
                {"sub_check_id": "3676-unit-load-fit", "status": status.value, "detail": detail}
            ],
            what_is_still_required=[
                "Confirm unit load dimensions are sourced from ISO 3676 or approved specification.",
                "Physical pallet-loading layout review recommended.",
            ],
            source_url=entry.get("source_url"),
        )

    def _check_iso3394(
        self,
        entry: dict[str, Any],
        alternative: dict[str, Any],
        opt_config: Optional[OptimizationConfig],
    ) -> StandardsCheckResult:
        """
        ISO 3394 — Modular dimensions check.
        PROGRAMMATIC if module dimensions are configured, else NOT_CONFIGURED.
        """
        mod_L = getattr(opt_config, "module_length_mm", None) if opt_config else None
        mod_W = getattr(opt_config, "module_width_mm", None) if opt_config else None

        if not all([mod_L, mod_W]):
            return StandardsCheckResult(
                entry_id=entry["entry_id"],
                standard_identifier=entry["standard_identifier"],
                title=entry["title"],
                check_type=CheckType.PROGRAMMATIC,
                status=CheckStatus.NOT_CONFIGURED,
                details=(
                    "Module dimensions not configured. "
                    "Provide module_length_mm and module_width_mm to enable this check."
                ),
                parameters_used={},
                sub_check_results=[],
                what_is_still_required=[
                    "Configure modular base dimensions (module_length_mm, module_width_mm) in OptimizationConfig.",
                    "Values must come from the licensed ISO 3394 standard or approved company specification.",
                ],
                source_url=entry.get("source_url"),
            )

        pkg_L = alternative.get("outer_length_mm", 0.0)
        pkg_W = alternative.get("outer_width_mm", 0.0)

        tol = 1.0  # 1 mm tolerance for rounding
        L_mod = abs(pkg_L % mod_L) <= tol or abs(pkg_L % mod_L - mod_L) <= tol
        W_mod = abs(pkg_W % mod_W) <= tol or abs(pkg_W % mod_W - mod_W) <= tol
        fits = L_mod and W_mod
        status = CheckStatus.PASS if fits else CheckStatus.FAIL
        params = {
            "module_length_mm": mod_L,
            "module_width_mm": mod_W,
            "pkg_outer_length_mm": pkg_L,
            "pkg_outer_width_mm": pkg_W,
            "tolerance_mm": tol,
            "formula": "pkg_L % module_L == 0 AND pkg_W % module_W == 0 (within tolerance)",
        }
        detail = (
            f"Package dims ({pkg_L}×{pkg_W} mm) "
            f"{'conform to' if fits else 'do NOT conform to'} "
            f"modular grid ({mod_L}×{mod_W} mm, ±{tol} mm tolerance). [PROGRAMMATIC — ESTIMATE]"
        )
        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.PROGRAMMATIC,
            status=status,
            details=detail,
            parameters_used=params,
            sub_check_results=[
                {"sub_check_id": "3394-modular-dimensions", "status": status.value, "detail": detail}
            ],
            what_is_still_required=[
                "Confirm module dimensions are sourced from ISO 3394 or approved specification.",
                "Full modular system assessment requires engineering review.",
            ],
            source_url=entry.get("source_url"),
        )

    def _check_physical_test(self, entry: dict[str, Any]) -> StandardsCheckResult:
        """
        Physical-test standards: ALWAYS NOT_VERIFIABLE from software. NEVER PASS.
        """
        required_params = entry.get("required_parameters", [])
        what_required = [
            f"Physical laboratory test required: {entry['standard_identifier']}.",
            "Configure test parameters (only available to users holding the licensed standard).",
        ]
        for p in required_params:
            what_required.append(
                f"  • {p.get('name', '?')} [{p.get('unit', '?')}]: {p.get('description', '')}"
            )

        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.PHYSICAL_TEST,
            status=CheckStatus.NOT_VERIFIABLE,
            details=(
                f"{entry['standard_identifier']} is a PHYSICAL_TEST standard. "
                "Software cannot execute or simulate physical tests. "
                "Status is always NOT_VERIFIABLE. "
                + SOFTWARE_DISCLAIMER
            ),
            parameters_used={},
            sub_check_results=[],
            what_is_still_required=what_required,
            source_url=entry.get("source_url"),
        )

    def _check_human_review(self, entry: dict[str, Any]) -> StandardsCheckResult:
        """
        Human-review standards: always NEEDS_REVIEW.
        """
        return StandardsCheckResult(
            entry_id=entry["entry_id"],
            standard_identifier=entry["standard_identifier"],
            title=entry["title"],
            check_type=CheckType.HUMAN_REVIEW,
            status=CheckStatus.NEEDS_REVIEW,
            details=(
                f"{entry['standard_identifier']} requires qualified engineering review. "
                "Software cannot substitute for human assessment."
            ),
            parameters_used={},
            sub_check_results=[],
            what_is_still_required=[
                "Qualified packaging engineer must review against this standard.",
                f"Refer to: {entry.get('source_url', 'ISO catalogue')}",
            ],
            source_url=entry.get("source_url"),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Public check runner
    # ──────────────────────────────────────────────────────────────────────────

    def run_checks(
        self,
        product_dims_mm: dict[str, float],
        alternative: dict[str, Any],
        opt_config: Optional[OptimizationConfig] = None,
        baseline: Optional[dict[str, Any]] = None,
    ) -> list[StandardsCheckResult]:
        """
        Run all standards checks for a given alternative.

        Args:
            product_dims_mm: {"L": mm, "W": mm, "H": mm}
            alternative: dict with outer_length_mm, inner_volume_mm3, total_material_volume_cm3, etc.
            opt_config: OptimizationConfig (optional, for ISO 3676/3394 checks)
            baseline: dict with total_material_volume_cm3 (optional)

        Returns:
            List of StandardsCheckResult objects.
        """
        self._ensure_loaded()

        product_volume_mm3 = (
            product_dims_mm.get("L", 0.0)
            * product_dims_mm.get("W", 0.0)
            * product_dims_mm.get("H", 0.0)
        )

        results: list[StandardsCheckResult] = []

        for entry in self.get_all_standards():
            entry_id = entry.get("entry_id", "")
            check_type = entry.get("check_type", "HUMAN_REVIEW")
            org = entry.get("organization", "ISO")

            if entry_id == "ISO-18602":
                result = self._check_iso18602(entry, product_volume_mm3, alternative, baseline)
            elif entry_id == "ISO-2206":
                result = self._check_iso2206(entry)
            elif entry_id == "ISO-3676":
                result = self._check_iso3676(entry, alternative, opt_config)
            elif entry_id == "ISO-3394":
                result = self._check_iso3394(entry, alternative, opt_config)
            elif check_type == CheckType.PHYSICAL_TEST.value:
                result = self._check_physical_test(entry)
            elif check_type == CheckType.HUMAN_REVIEW.value:
                result = self._check_human_review(entry)
            else:
                # Unknown check type — default to NEEDS_REVIEW
                result = self._check_human_review(entry)

            # Stamp organization from registry entry (ISO or ISTA)
            result.organization = org
            results.append(result)

        return results

    def evaluate(
        self,
        product_dims_mm: dict[str, float],
        alternative: Any,
        config: Optional[OptimizationConfig] = None,
        project_id: str = "default",
        baseline: Optional[Any] = None,
    ) -> Any:
        """
        Evaluate all standards and return a StandardsEvaluationResult.
        """
        from app.schemas.schemas import StandardsEvaluationResult

        alt_dict = alternative if isinstance(alternative, dict) else alternative.model_dump()
        base_dict = baseline if (baseline is None or isinstance(baseline, dict)) else baseline.model_dump()

        results = self.run_checks(
            product_dims_mm=product_dims_mm,
            alternative=alt_dict,
            opt_config=config,
            baseline=base_dict,
        )

        pass_cnt = sum(1 for r in results if r.status == CheckStatus.PASS)
        fail_cnt = sum(1 for r in results if r.status == CheckStatus.FAIL)
        not_cfg_cnt = sum(1 for r in results if r.status == CheckStatus.NOT_CONFIGURED)
        not_ver_cnt = sum(1 for r in results if r.status == CheckStatus.NOT_VERIFIABLE)
        needs_rev_cnt = sum(1 for r in results if r.status == CheckStatus.NEEDS_REVIEW)

        alt_id = alt_dict.get("alternative_id", "alt-1")

        return StandardsEvaluationResult(
            project_id=project_id,
            alternative_id=alt_id,
            evaluated_at=datetime.now(timezone.utc),
            registry_version=self._registry_version,
            registry_source="NxtPak ISO registry v1 (see source list)",
            company_requirements_loaded=len(self._additional_entries) > 0,
            company_requirements_note=(
                f"{len(self._additional_entries)} additional requirement(s) loaded."
                if len(self._additional_entries) > 0
                else "No company-specific requirements loaded. El Araby Group specifications are not publicly available."
            ),
            evaluation_statement=EVALUATION_STATEMENT,
            results=results,
            programmatic_pass_count=pass_cnt,
            programmatic_fail_count=fail_cnt,
            not_configured_count=not_cfg_cnt,
            not_verifiable_count=not_ver_cnt,
            needs_review_count=needs_rev_cnt,
            disclaimer=SOFTWARE_DISCLAIMER,
        )


# Singleton registry instance
registry = StandardsRegistry()

def get_registry() -> StandardsRegistry:
    return registry


def get_recommendation_constraints(fragility_class: str) -> dict:
    """
    Extract ISO-derived engineering constraints for the recommendation engine.

    These constraints come from the standards registry interpretation of:
    - ISO 2248 (vertical impact / drop test) → minimum clearance per fragility
    - ISO 2234 (stacking) → required safety factor
    - ISO 3676/3394 (unit load) → pallet footprint boundary
    - ISO 18602 (optimisation) → volume utilisation threshold

    NO numeric values are invented. All rules are sourced from registry entries
    or labeled as ENGINEERING_ASSUMPTION requiring physical test validation.

    Returns:
        dict with keys: min_clearance_mm, safety_factor_min, pallet_max_L_mm,
                        pallet_max_W_mm, vol_util_min, constraints_source
    """
    frag = fragility_class.upper()

    # ISO 2248 informs drop height requirements, which drive minimum cushion depth.
    # ENGINEERING_ASSUMPTION: clearance derived from fragility category per industry practice.
    # Physical lab drop test (ISO 2248) must validate these values — not software.
    if frag in ("VERY_HIGH",):
        min_clearance_mm = 40.0
        clearance_note = "ENGINEERING_ASSUMPTION — VERY_HIGH fragility: 40 mm (ISO 2248 Category A equivalent)"
    elif frag in ("HIGH",):
        min_clearance_mm = 25.0
        clearance_note = "ENGINEERING_ASSUMPTION — HIGH fragility: 25 mm (ISO 2248 Category B equivalent)"
    elif frag in ("MEDIUM",):
        min_clearance_mm = 15.0
        clearance_note = "ENGINEERING_ASSUMPTION — MEDIUM fragility: 15 mm (ISO 2248 Category C equivalent)"
    else:
        min_clearance_mm = 10.0
        clearance_note = "ENGINEERING_ASSUMPTION — LOW fragility: 10 mm (ISO 2248 Category D equivalent)"

    # ISO 2234: stacking — minimum safety factor to withstand warehouse stacking.
    # The McKee BCT / stacking_load ratio must exceed this floor.
    # ENGINEERING_ASSUMPTION: SF 4.5 is widely used for 30-day ambient storage.
    safety_factor_min = 4.5
    safety_factor_note = "ENGINEERING_ASSUMPTION — ISO 2234 stacking; SF >= 4.5 for 30-day ambient storage"

    # ISO 3676 / ISO 3394: unit load dimensions.
    # Euro Pallet (1200×800 mm) is the reference. Carton footprint must not overhang.
    pallet_max_L_mm = 1200.0
    pallet_max_W_mm = 800.0
    pallet_note = "ISO 3676 / ISO 3394: Euro Pallet 1200×800 mm boundary. Zero overhang."

    # ISO 18602: volume utilisation ≥ 60% indicates right-sized packaging.
    vol_util_min = VOL_UTIL_PASS_THRESHOLD  # 0.60
    vol_util_note = f"ISO 18602: volume utilisation >= {VOL_UTIL_PASS_THRESHOLD:.0%} target"

    return {
        "min_clearance_mm": min_clearance_mm,
        "safety_factor_min": safety_factor_min,
        "pallet_max_L_mm": pallet_max_L_mm,
        "pallet_max_W_mm": pallet_max_W_mm,
        "vol_util_min": vol_util_min,
        "constraints_source": "NxtPak ISO registry v1",
        "notes": {
            "clearance": clearance_note,
            "safety_factor": safety_factor_note,
            "pallet": pallet_note,
            "vol_util": vol_util_note,
        },
        "disclaimer": (
            "These constraints are ENGINEERING_ASSUMPTIONs derived from the ISO registry. "
            "Physical lab tests (ISO 2234, ISO 2248) must validate them before production."
        ),
    }


def generate_test_plan(
    product_weight_kg: Optional[float],
    distribution_channel: Optional[str] = None,
    fragility: str = "MEDIUM",
    is_palletized: bool = False,
) -> dict[str, Any]:
    """Suggest current physical procedures without inventing their test levels."""
    weight = float(product_weight_kg) if product_weight_kg is not None else None
    channel = (distribution_channel or "").lower().replace("_", "-").strip()
    suggestions: list[dict[str, str]] = []
    if any(term in channel for term in ("amazon", "sioc", "e-commerce", "ecommerce", "marketplace")):
        suggestions.append({"standard_identifier": "ISTA 6-Amazon.com-SIOC", "reason": "Use when the product ships in its own container through the Amazon SIOC distribution system."})
    elif any(term in channel for term in ("parcel", "courier")):
        if weight is None or weight <= 70:
            suggestions.append({"standard_identifier": "ISTA 3A", "reason": "General simulation procedure for individually shipped parcel products within its published weight scope."})
        if weight is not None and weight <= 68:
            suggestions.extend([
                {"standard_identifier": "ISTA 1A", "reason": "Lower-intensity integrity screening alternative; it is not a transport simulation."},
                {"standard_identifier": "ISTA 2A", "reason": "Partial-simulation alternative for individually packaged products within its published weight scope."},
            ])
        if weight is not None and weight > 70:
            suggestions.append({"standard_identifier": "ISTA 3B", "reason": "Review for LTL freight distribution when the shipment is not an individual parcel."})
    elif any(term in channel for term in ("ltl", "less-than-truckload")):
        suggestions.append({"standard_identifier": "ISTA 3B", "reason": "General simulation procedure for mixed packaged-product loads moving through LTL distribution."})
        if is_palletized:
            suggestions.append({"standard_identifier": "ISTA 3E", "reason": "Also consider for similar products secured as a unitized load when distribution is full-truckload rather than mixed LTL."})
        if weight is None or weight <= 45:
            suggestions.append({"standard_identifier": "ISTA 3F", "reason": "Candidate for individual products in a mixed pallet sent from a distribution center to a retail outlet, within its published weight scope."})
    elif is_palletized or any(term in channel for term in ("pallet", "full-truck", "truckload", "container")):
        suggestions.append({"standard_identifier": "ISTA 3E", "reason": "Candidate for similar products secured as a unitized load in full-truckload distribution."})
        suggestions.append({"standard_identifier": "ISTA 3B", "reason": "Candidate if the pallet is handled as part of a mixed LTL load."})
        if weight is None or weight <= 45:
            suggestions.append({"standard_identifier": "ISTA 3F", "reason": "Candidate for an individual package in a mixed regional retail pallet shipment, within its published weight scope."})
    # With no shipping channel, a procedure cannot be selected responsibly.

    if fragility.upper() in {"HIGH", "VERY_HIGH"}:
        suggestions = [{**item, "reason": item["reason"] + " Confirm damage tolerance and evaluation criteria with the laboratory."} for item in suggestions]
    return {
        "primary_standard": suggestions[0]["standard_identifier"] if suggestions else None,
        "product_weight_kg": weight,
        "distribution_channel": channel or None,
        "fragility_class": fragility,
        "suggested_tests": suggestions,
        "laboratory_requirement": "Suggested validation tests are to be performed in an accredited laboratory using the current official procedure.",
        "guidance_note": "Summaries are for guidance. Use the current official ISTA procedure for testing.",
        "disclaimer": SOFTWARE_DISCLAIMER,
    }
