"""
NxtPak AI — Orchestrator Agent
Coordinates workflow: passes structured data, validates constraints,
runs optimization, checks standards, returns structured outputs.
No unnecessary frameworks — plain, typed Python class.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.agents.product_specs_agent import ProductSpecsAgent, ProductSpecsValidationError
from app.geometry.engine_interface import GeometryEngine
from app.optimization.engine import OptimizationEngine
from app.schemas.schemas import (
    CheckStatus,
    CheckType,
    OptimizationConfig,
    OptimizationResult,
    ProductInput,
    BaselinePackaging,
    StandardsEvaluationResult,
)
from app.standards.registry import StandardsRegistry, get_registry
from app.validation.validator import validate_baseline

logger = logging.getLogger(__name__)


class WorkflowError(Exception):
    """Raised when an orchestration step blocks."""
    def __init__(self, message: str, details: Optional[list[str]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


class Orchestrator:
    """
    Central coordinator of the NxtPak optimization pipeline.
    """

    def __init__(
        self,
        specs_agent: Optional[ProductSpecsAgent] = None,
        opt_engine: Optional[OptimizationEngine] = None,
        geom_engine: Optional[GeometryEngine] = None,
        registry: Optional[StandardsRegistry] = None,
    ):
        self.specs_agent = specs_agent or ProductSpecsAgent()
        self.opt_engine = opt_engine or OptimizationEngine()
        self.geom_engine = geom_engine or GeometryEngine()
        self.registry = registry or get_registry()

    def run_pipeline(
        self,
        project_id: str,
        product_input: ProductInput,
        baseline: Optional[BaselinePackaging] = None,
        config: Optional[OptimizationConfig] = None,
    ) -> dict[str, Any]:
        """
        Execute the end-to-end optimization pipeline:
        1. Validate & normalize product specs
        2. Validate baseline (if provided)
        3. Generate & rank packaging alternatives
        4. Run ISO standards evaluations on all alternatives
        5. Generate 3D geometry payloads
        """
        logger.info("Pipeline started for project %s", project_id)

        # 1. Product specs validation
        try:
            norm_product = self.specs_agent.normalize(product_input)
        except ProductSpecsValidationError as e:
            raise WorkflowError("Product specification validation failed", e.errors)

        # 2. Baseline validation
        if baseline:
            base_val = validate_baseline(baseline.model_dump())
            if not base_val.is_valid:
                raise WorkflowError("Baseline packaging validation failed", base_val.errors)

        # 3. Optimization engine
        cfg = config or OptimizationConfig()
        opt_result = self.opt_engine.generate_alternatives(
            project_id=project_id,
            product_name=norm_product["name"],
            product_dims_mm=norm_product["dims_mm"],
            product_weight_kg=norm_product["weight_kg"],
            fragility_class=norm_product["fragility_class"],
            baseline=baseline,
            config=cfg,
        )

        # 4. Standards evaluation for the recommended alternative
        recommended_alt = opt_result.recommended
        std_eval = self.registry.evaluate(
            product_dims_mm=norm_product["dims_mm"],
            alternative=recommended_alt,
            config=cfg,
            project_id=project_id,
        )

        # Attach standards summary to each alternative
        for alt in opt_result.alternatives:
            alt_eval = self.registry.evaluate(
                product_dims_mm=norm_product["dims_mm"],
                alternative=alt,
                config=cfg,
                project_id=project_id,
            )
            alt.standards_summary = {
                "programmatic_pass": alt_eval.programmatic_pass_count,
                "needs_review": alt_eval.needs_review_count,
                "not_verifiable": alt_eval.not_verifiable_count,
                "not_configured": alt_eval.not_configured_count,
            }

        # 5. Geometry generation for recommended alternative
        geom_data = self.geom_engine.generate_packaging_geometry(
            outer_dims_mm={
                "L": recommended_alt.outer_length_mm,
                "W": recommended_alt.outer_width_mm,
                "H": recommended_alt.outer_height_mm,
            },
            inner_dims_mm={
                "L": recommended_alt.inner_length_mm,
                "W": recommended_alt.inner_width_mm,
                "H": recommended_alt.inner_height_mm,
            },
            product_dims_mm=norm_product["dims_mm"],
            insert_thickness_mm=recommended_alt.insert_thickness_mm,
        )

        logger.info("Pipeline completed successfully for project %s", project_id)

        return {
            "project_id": project_id,
            "normalized_product": norm_product,
            "optimization_result": opt_result.model_dump(mode="json"),
            "standards_result": std_eval.model_dump(mode="json"),
            "geometry_data": geom_data,
            "active_geometry_engine": self.geom_engine.engine_name,
        }
