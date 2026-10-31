"""
NxtPak AI — Geometry Engine Interface
Unit-aware parametric geometry for box, product placeholder, and inserts.
Detects active engine (trimesh or numpy_only fallback).
Documents active engine in all outputs.
"""

from __future__ import annotations

import io
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Check if trimesh is available
_HAS_TRIMESH = False
try:
    import trimesh
    _HAS_TRIMESH = True
    logger.info("GeometryEngine: trimesh detected and activated.")
except ImportError:
    logger.warning("GeometryEngine: trimesh not found. Falling back to numpy_only geometry engine.")


def get_active_engine() -> str:
    """Return the currently active 3D geometry engine name."""
    return "trimesh" if _HAS_TRIMESH else "numpy_only"


def _generate_box_faces_vertices(L: float, W: float, H: float, center: bool = True) -> dict[str, Any]:
    """
    Generate vertices and triangular faces for a rectangular box [L x W x H].
    Returns dict formatted for direct use in Three.js BufferGeometry or trimesh.
    """
    dx = L / 2.0 if center else L
    dy = H / 2.0 if center else H
    dz = W / 2.0 if center else W
    x0, x1 = (-dx, dx) if center else (0.0, L)
    y0, y1 = (-dy, dy) if center else (0.0, H)
    z0, z1 = (-dz, dz) if center else (0.0, W)

    # 8 vertices
    vertices = [
        [x0, y0, z0],  # 0
        [x1, y0, z0],  # 1
        [x1, y1, z0],  # 2
        [x0, y1, z0],  # 3
        [x0, y0, z1],  # 4
        [x1, y0, z1],  # 5
        [x1, y1, z1],  # 6
        [x0, y1, z1],  # 7
    ]

    # 12 triangles (2 per face)
    faces = [
        # Front (z0)
        [0, 2, 1], [0, 3, 2],
        # Back (z1)
        [4, 5, 6], [4, 6, 7],
        # Bottom (y0)
        [0, 1, 5], [0, 5, 4],
        # Top (y1)
        [3, 6, 2], [3, 7, 6],
        # Left (x0)
        [0, 4, 7], [0, 7, 3],
        # Right (x1)
        [1, 2, 6], [1, 6, 5],
    ]

    return {
        "vertices": vertices,
        "faces": faces,
        "dimensions_mm": {"length": L, "width": W, "height": H},
    }


class GeometryEngine:
    """
    Parametric geometry generator for packaging visualization.
    Provides Three.js-compatible buffer representations and GLB export.
    """

    def __init__(self, engine_override: Optional[str] = None):
        self.engine_name = engine_override or get_active_engine()

    def generate_packaging_geometry(
        self,
        outer_dims_mm: dict[str, float],
        inner_dims_mm: dict[str, float],
        product_dims_mm: dict[str, float],
        insert_thickness_mm: float = 0.0,
    ) -> dict[str, Any]:
        """
        Generate geometry description for:
        1. Outer carton
        2. Inner cavity
        3. Product bounding box
        4. Inserts (if present)
        """
        outer_box = _generate_box_faces_vertices(
            outer_dims_mm["L"], outer_dims_mm["W"], outer_dims_mm["H"]
        )
        inner_box = _generate_box_faces_vertices(
            inner_dims_mm["L"], inner_dims_mm["W"], inner_dims_mm["H"]
        )
        product_box = _generate_box_faces_vertices(
            product_dims_mm["L"], product_dims_mm["W"], product_dims_mm["H"]
        )

        inserts_box: Optional[dict[str, Any]] = None
        if insert_thickness_mm > 0:
            inserts_box = _generate_box_faces_vertices(
                product_dims_mm["L"] + 2 * insert_thickness_mm,
                product_dims_mm["W"] + 2 * insert_thickness_mm,
                product_dims_mm["H"] + 2 * insert_thickness_mm,
            )

        return {
            "engine": self.engine_name,
            "units": "mm",
            "outer_carton": outer_box,
            "inner_cavity": inner_box,
            "product_mesh": product_box,
            "inserts_mesh": inserts_box,
            "iso_2206_face_labels": {
                "face_1": "Top (+Y)",
                "face_2": "Right (+X)",
                "face_3": "Bottom (-Y)",
                "face_4": "Left (-X)",
                "face_5": "Front (+Z)",
                "face_6": "Back (-Z)",
            },
        }

    def export_glb_bytes(
        self,
        outer_dims_mm: dict[str, float],
        product_dims_mm: dict[str, float],
    ) -> Optional[bytes]:
        """
        Create a 3D GLB binary file using trimesh (if available).
        Returns bytes or None if trimesh is not available.
        """
        if not _HAS_TRIMESH:
            logger.info("GLB export skipped: trimesh not active.")
            return None

        try:
            # Carton box
            box = trimesh.creation.box(
                extents=[outer_dims_mm["L"], outer_dims_mm["H"], outer_dims_mm["W"]]
            )
            # Semi-transparent packaging visual
            box.visual = trimesh.visual.ColorVisuals(
                mesh=box,
                face_colors=[200, 160, 100, 180],
            )

            # Product box
            prod = trimesh.creation.box(
                extents=[product_dims_mm["L"], product_dims_mm["H"], product_dims_mm["W"]]
            )
            prod.visual = trimesh.visual.ColorVisuals(
                mesh=prod,
                face_colors=[60, 120, 220, 240],
            )

            scene = trimesh.Scene([box, prod])
            glb_data = scene.export(file_type="glb")
            if isinstance(glb_data, bytes):
                return glb_data
            elif hasattr(glb_data, "read"):
                return glb_data.read()
            return None
        except Exception as exc:
            logger.error("Failed to generate GLB: %s", exc)
            return None
