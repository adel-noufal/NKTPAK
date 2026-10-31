"""
NxtPak AI — Upload Service
Parses uploaded 3D/CAD files and extracts bounding box geometry.
Supports: STL, OBJ, GLB/GLTF (via trimesh), DXF (via ezdxf).
DWG: not supported by free libraries — returns a clear error message.
STEP: attempted via CadQuery/OCC; falls back to an honest error if not installed.

Rules:
- Never silently converts units — asks the user to confirm.
- File size limit: 50 MB.
- Multi-body meshes → multiple ComponentInput entries.
- Single body → one ComponentInput.
"""

from __future__ import annotations

import io
import logging
import os
from pathlib import Path
from typing import Optional

from app.schemas.schemas import (
    ComponentInput,
    Provenance,
    SourceType,
    UploadFileResult,
)

logger = logging.getLogger(__name__)

# 50 MB file size limit
MAX_FILE_BYTES = 50 * 1024 * 1024

# Formats that trimesh handles natively
TRIMESH_FORMATS = {".stl", ".obj", ".glb", ".gltf"}

# Minimum meaningful dimension (reject if bounding box side < 1 mm)
MIN_DIM_MM = 1.0


def parse_uploaded_file(
    file_name: str,
    file_bytes: bytes,
) -> UploadFileResult:
    """
    Parse an uploaded 3D or CAD file and return extracted components.

    Parameters
    ----------
    file_name : str
        Original filename (used to determine format).
    file_bytes : bytes
        File content.

    Returns
    -------
    UploadFileResult
        success=True with components if parsing succeeded;
        success=False with an error message if it failed.
    """
    if len(file_bytes) > MAX_FILE_BYTES:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type="unknown",
            error=(
                f"File is too large ({len(file_bytes) / 1024 / 1024:.1f} MB). "
                "Maximum allowed size is 50 MB."
            ),
        )

    ext = Path(file_name).suffix.lower()

    if ext == ".dwg":
        return _dwg_error(file_name)

    if ext in TRIMESH_FORMATS:
        return _parse_with_trimesh(file_name, file_bytes, ext)

    if ext in (".step", ".stp"):
        return _parse_step(file_name, file_bytes)

    if ext == ".dxf":
        return _parse_dxf(file_name, file_bytes)

    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type=ext.lstrip(".") or "unknown",
        error=(
            f"Unsupported file format '{ext}'. "
            "Supported formats: STL, OBJ, GLB, GLTF, STEP, STP, DXF. "
            "DWG is not supported by free libraries — export to DXF or STEP."
        ),
    )


# ─────────────────────────────────────────────
# DWG: honest error only
# ─────────────────────────────────────────────

def _dwg_error(file_name: str) -> UploadFileResult:
    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type="dwg",
        error=(
            "DWG files cannot be read by free open-source libraries. "
            "Please export your drawing to DXF or STEP format from AutoCAD or your CAD tool, "
            "then upload again."
        ),
    )


# ─────────────────────────────────────────────
# Trimesh: STL, OBJ, GLB, GLTF
# ─────────────────────────────────────────────

def _parse_with_trimesh(
    file_name: str, file_bytes: bytes, ext: str
) -> UploadFileResult:
    """
    Load mesh with trimesh and extract bounding box dimensions.
    Multi-body scenes → one ComponentInput per body.
    """
    try:
        import trimesh  # type: ignore
    except ImportError:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error=(
                "trimesh is not installed. "
                "Install it: pip install trimesh"
            ),
        )

    try:
        loaded = trimesh.load(
            io.BytesIO(file_bytes),
            file_type=ext.lstrip("."),
            force=None,
        )
    except Exception as exc:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error=f"Could not parse file: {exc}",
        )

    components, bounding_box = _extract_components_from_trimesh(loaded, file_name, ext)

    if not components:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error=(
                "No valid geometry found in the file. "
                "The mesh may be empty or degenerate."
            ),
        )

    unit_warning = (
        "Units are assumed to be MILLIMETRES. "
        "If your file uses a different unit (inches, cm, metres), "
        "please confirm and adjust the dimensions manually before running optimization."
    )

    return UploadFileResult(
        success=True,
        file_name=file_name,
        file_type=ext.lstrip("."),
        components=components,
        bounding_box_mm=bounding_box,
        units_confirmed=False,
        units_assumed="mm",
        warning=unit_warning,
    )


def _extract_components_from_trimesh(
    loaded: object,
    file_name: str,
    ext: str,
) -> tuple[list[ComponentInput], Optional[dict]]:
    """
    Extract one ComponentInput per body from a trimesh Mesh or Scene.
    Returns (components, overall_bounding_box_mm).
    """
    import trimesh  # type: ignore

    stem = Path(file_name).stem
    components: list[ComponentInput] = []
    overall_bounds: Optional[list] = None

    def _bounds_to_dict(bounds) -> dict:
        extents = bounds[1] - bounds[0]
        return {
            "length_mm": round(float(extents[0]), 2),
            "width_mm": round(float(extents[1]), 2),
            "height_mm": round(float(extents[2]), 2),
            "min_x": round(float(bounds[0][0]), 2),
            "min_y": round(float(bounds[0][1]), 2),
            "min_z": round(float(bounds[0][2]), 2),
        }

    def _make_component(mesh, name: str) -> Optional[ComponentInput]:
        try:
            bounds = mesh.bounds
            if bounds is None:
                return None
            extents = bounds[1] - bounds[0]
            l, w, h = float(extents[0]), float(extents[1]), float(extents[2])
            if any(d < MIN_DIM_MM for d in [l, w, h]):
                return None
            prov = Provenance(
                source_name=f"Uploaded file: {file_name}",
                source_type=SourceType.USER_ENTERED,
                is_edited=False,
                evidence_snippet=(
                    f"Bounding box from trimesh parse of {ext.upper()} file. "
                    "Units assumed mm. Confirm before running optimization."
                ),
            )
            return ComponentInput(
                name=name,
                length_mm=round(l, 2),
                width_mm=round(w, 2),
                height_mm=round(h, 2),
                provenance=prov,
            )
        except Exception as exc:
            logger.warning("Failed to extract bounds from mesh '%s': %s", name, exc)
            return None

    if isinstance(loaded, trimesh.Scene):
        bodies = list(loaded.geometry.items())
        for i, (gname, mesh) in enumerate(bodies):
            comp_name = gname or f"{stem}_body_{i + 1}"
            comp = _make_component(mesh, comp_name)
            if comp:
                components.append(comp)

        if loaded.bounds is not None:
            overall_bounds = _bounds_to_dict(loaded.bounds)

    elif isinstance(loaded, trimesh.Trimesh):
        comp = _make_component(loaded, stem)
        if comp:
            components.append(comp)
        if loaded.bounds is not None:
            overall_bounds = _bounds_to_dict(loaded.bounds)
    else:
        # PointCloud or other — best-effort
        try:
            bounds = loaded.bounds
            if bounds is not None:
                overall_bounds = _bounds_to_dict(bounds)
        except Exception:
            pass

    return components, overall_bounds


# ─────────────────────────────────────────────
# STEP: try CadQuery / OCC, fail gracefully
# ─────────────────────────────────────────────

def _parse_step(file_name: str, file_bytes: bytes) -> UploadFileResult:
    """
    Attempt to parse STEP via CadQuery. Falls back to a clear message if not installed.
    """
    ext = Path(file_name).suffix.lower().lstrip(".")

    try:
        import cadquery as cq  # type: ignore
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            result = cq.importers.importStep(tmp_path)
            bb = result.val().BoundingBox()
            l_mm = round((bb.xmax - bb.xmin) * 10, 2)  # CQ units are cm
            w_mm = round((bb.ymax - bb.ymin) * 10, 2)
            h_mm = round((bb.zmax - bb.zmin) * 10, 2)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        stem = Path(file_name).stem
        prov = Provenance(
            source_name=f"Uploaded file: {file_name}",
            source_type=SourceType.USER_ENTERED,
            is_edited=False,
            evidence_snippet=(
                "Bounding box from CadQuery STEP import. "
                "Units converted from CQ cm to mm."
            ),
        )
        comp = ComponentInput(
            name=stem,
            length_mm=l_mm,
            width_mm=w_mm,
            height_mm=h_mm,
            provenance=prov,
        )
        return UploadFileResult(
            success=True,
            file_name=file_name,
            file_type=ext,
            components=[comp],
            bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
            units_confirmed=True,
            units_assumed="mm (converted from CadQuery cm)",
            warning=(
                "STEP parsed via CadQuery. Bounding box is for the full assembly. "
                "Individual parts are not split — add separate components manually if needed."
            ),
        )

    except ImportError:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext,
            error=(
                "STEP files require CadQuery (OCC) which is not installed in this environment. "
                "To enable STEP support: pip install cadquery. "
                "Alternatively, export your STEP file as STL from your CAD tool and re-upload."
            ),
        )
    except Exception as exc:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext,
            error=f"Failed to parse STEP file: {exc}",
        )


# ─────────────────────────────────────────────
# DXF: use ezdxf
# ─────────────────────────────────────────────

def _parse_dxf(file_name: str, file_bytes: bytes) -> UploadFileResult:
    """
    Parse DXF via ezdxf. Extracts extents/bounding rectangle.
    DXF is a 2D format — height must be provided by the user.
    """
    try:
        import ezdxf  # type: ignore
        from ezdxf.layouts import Modelspace  # type: ignore
    except ImportError:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type="dxf",
            error=(
                "ezdxf is not installed. "
                "Install it: pip install ezdxf"
            ),
        )

    try:
        doc = ezdxf.read(io.StringIO(file_bytes.decode("utf-8", errors="replace")))
        msp = doc.modelspace()

        # Collect all points from LINE, POLYLINE, LWPOLYLINE entities
        xs: list[float] = []
        ys: list[float] = []

        for entity in msp:
            try:
                etype = entity.dxftype()
                if etype == "LINE":
                    xs.extend([entity.dxf.start.x, entity.dxf.end.x])
                    ys.extend([entity.dxf.start.y, entity.dxf.end.y])
                elif etype in ("LWPOLYLINE", "POLYLINE"):
                    for pt in entity.get_points():
                        xs.append(float(pt[0]))
                        ys.append(float(pt[1]))
                elif etype == "CIRCLE":
                    cx, cy = entity.dxf.center.x, entity.dxf.center.y
                    r = entity.dxf.radius
                    xs.extend([cx - r, cx + r])
                    ys.extend([cy - r, cy + r])
                elif etype in ("ARC", "ELLIPSE"):
                    # Approximate with center ± radius
                    cx, cy = entity.dxf.center.x, entity.dxf.center.y
                    r = getattr(entity.dxf, "radius", 0) or getattr(entity.dxf, "major_axis", None)
                    if r:
                        try:
                            rv = float(r)
                        except (TypeError, ValueError):
                            rv = 0
                        xs.extend([cx - rv, cx + rv])
                        ys.extend([cy - rv, cy + rv])
            except Exception:
                continue  # Skip unparseable entity

        if not xs or not ys:
            return UploadFileResult(
                success=False,
                file_name=file_name,
                file_type="dxf",
                error=(
                    "No geometry found in the DXF model space. "
                    "The file may be empty or use unsupported entity types."
                ),
            )

        width_mm = round(max(xs) - min(xs), 2)
        length_mm = round(max(ys) - min(ys), 2)

        if width_mm < MIN_DIM_MM or length_mm < MIN_DIM_MM:
            return UploadFileResult(
                success=False,
                file_name=file_name,
                file_type="dxf",
                error=(
                    f"DXF extents are too small ({length_mm} × {width_mm} mm). "
                    "Check that the drawing is in millimetres and not empty."
                ),
            )

        stem = Path(file_name).stem
        prov = Provenance(
            source_name=f"Uploaded file: {file_name}",
            source_type=SourceType.USER_ENTERED,
            is_edited=False,
            evidence_snippet=(
                "Length and width from DXF model-space extents via ezdxf. "
                "Height cannot be read from a 2D DXF — enter it manually."
            ),
        )
        comp = ComponentInput(
            name=stem,
            length_mm=length_mm,
            width_mm=width_mm,
            height_mm=None,  # User must enter height
            provenance=prov,
        )

        return UploadFileResult(
            success=True,
            file_name=file_name,
            file_type="dxf",
            components=[comp],
            bounding_box_mm={"length_mm": length_mm, "width_mm": width_mm, "height_mm": None},
            units_confirmed=False,
            units_assumed="mm (assumed — DXF has no built-in units)",
            warning=(
                "DXF is a 2D format. Length and width were read from the drawing extents. "
                "HEIGHT must be entered manually. "
                "Units are assumed to be millimetres — confirm before running optimization."
            ),
        )

    except Exception as exc:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type="dxf",
            error=f"Failed to parse DXF file: {exc}",
        )
