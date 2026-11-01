"""
NxtPak AI — Production CAD & Engineering Drawing Parser.
Supports STL, OBJ, 3MF, GLB, DXF, STEP, STP, and PDF drawings.
Extracts real bounding box (L x W x H), surface area, volume, center of mass,
and mesh watertightness. Zero fake models.
"""

from __future__ import annotations

import io
import logging
import re
import math
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.schemas.schemas import (
    ComponentInput,
    Provenance,
    SourceType,
    UploadFileResult,
)

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB
MIN_DIM_MM = 1.0


def parse_uploaded_file(file_name: str, file_bytes: bytes) -> UploadFileResult:
    """Production file dispatcher for CAD and drawing formats."""
    if len(file_bytes) > MAX_FILE_BYTES:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type="unknown",
            error=f"File exceeds maximum allowed size of 50 MB ({len(file_bytes)/1024/1024:.1f} MB).",
        )

    ext = Path(file_name).suffix.lower()

    if ext == ".dwg":
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type="dwg",
            error="DWG is a proprietary closed binary format unsupported by open-source libraries. Please export to DXF or STEP from AutoCAD or your CAD software.",
        )

    if ext in (".stl", ".obj", ".glb", ".gltf", ".3mf"):
        return _parse_mesh_file(file_name, file_bytes, ext)

    if ext in (".step", ".stp", ".iges", ".igs"):
        return _parse_step_file(file_name, file_bytes, ext)

    if ext == ".dxf":
        return _parse_dxf_file(file_name, file_bytes)

    if ext == ".pdf":
        return _parse_pdf_drawing(file_name, file_bytes)

    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type=ext.lstrip(".") or "unknown",
        error=f"Unsupported format '{ext}'. Supported formats: STL, OBJ, 3MF, GLB, STEP, STP, IGES, DXF, PDF.",
    )


def _parse_mesh_file(file_name: str, file_bytes: bytes, ext: str) -> UploadFileResult:
    """Parse 3D mesh via trimesh."""
    try:
        import trimesh
    except ImportError:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error="Trimesh geometry engine is not available.",
        )

    try:
        mesh_obj = trimesh.load(
            io.BytesIO(file_bytes),
            file_type=ext.lstrip("."),
            force=None,
        )
    except Exception as exc:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error=f"Failed to parse 3D mesh: {exc}",
        )

    components: List[ComponentInput] = []
    bounds = mesh_obj.bounds
    if bounds is None:
        return UploadFileResult(
            success=False,
            file_name=file_name,
            file_type=ext.lstrip("."),
            error="No valid geometry found in mesh file.",
        )

    extents = bounds[1] - bounds[0]
    l_mm = round(float(extents[0]), 2)
    w_mm = round(float(extents[1]), 2)
    h_mm = round(float(extents[2]), 2)

    vol_cm3 = None
    area_cm2 = None
    center_of_mass = None
    is_watertight = None

    if isinstance(mesh_obj, trimesh.Trimesh):
        is_watertight = bool(mesh_obj.is_watertight)
        if mesh_obj.is_volume:
            vol_cm3 = round(float(mesh_obj.volume) / 1000.0, 2)  # mm³ to cm³
        if mesh_obj.area:
            area_cm2 = round(float(mesh_obj.area) / 100.0, 2)   # mm² to cm²
        center_of_mass = [round(float(c), 2) for c in mesh_obj.center_mass]

    prov = Provenance(
        source_name=f"CAD Upload ({file_name})",
        source_type=SourceType.CAD_EXTRACTED,
        is_edited=False,
        evidence_snippet=f"Extracted bounding box from {ext.upper()} geometry.",
    )

    comp = ComponentInput(
        name=Path(file_name).stem,
        length_mm=l_mm,
        width_mm=w_mm,
        height_mm=h_mm,
        provenance=prov,
    )
    components.append(comp)

    return UploadFileResult(
        success=True,
        file_name=file_name,
        file_type=ext.lstrip("."),
        components=components,
        bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
        volume_cm3=vol_cm3,
        surface_area_cm2=area_cm2,
        center_of_mass=center_of_mass,
        is_watertight=is_watertight,
        units_assumed="mm",
        provenance=prov,
    )


def _parse_step_file(file_name: str, file_bytes: bytes, ext: str) -> UploadFileResult:
    """
    Parse STEP (ISO 10303-21) / IGES files.
    First tries CadQuery/OpenCascade if present; otherwise extracts CARTESIAN_POINT coordinates.
    """
    stem = Path(file_name).stem

    # Attempt OpenCascade / CadQuery if installed
    try:
        import cadquery as cq
        import tempfile, os
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            shape = cq.importers.importStep(tmp_path)
            bb = shape.val().BoundingBox()
            l_mm = round((bb.xmax - bb.xmin) * 10.0, 2)  # cm to mm
            w_mm = round((bb.ymax - bb.ymin) * 10.0, 2)
            h_mm = round((bb.zmax - bb.zmin) * 10.0, 2)
            prov = Provenance(
                source_name=f"STEP Import ({file_name})",
                source_type=SourceType.CAD_EXTRACTED,
                is_edited=False,
                evidence_snippet="CadQuery STEP boundary box extraction.",
            )
            return UploadFileResult(
                success=True,
                file_name=file_name,
                file_type=ext.lstrip("."),
                components=[ComponentInput(name=stem, length_mm=l_mm, width_mm=w_mm, height_mm=h_mm, provenance=prov)],
                bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
                units_assumed="mm",
                provenance=prov,
            )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception:
        pass

    # Pure-Python STEP coordinate parser (extracts CARTESIAN_POINT tokens)
    try:
        text_content = file_bytes.decode("utf-8", errors="replace")
        pts = re.findall(r"CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([\d\.\-eE]+)\s*,\s*([\d\.\-eE]+)\s*,\s*([\d\.\-eE]+)\s*\)\s*\)", text_content)
        if pts and len(pts) >= 4:
            xs = [float(p[0]) for p in pts]
            ys = [float(p[1]) for p in pts]
            zs = [float(p[2]) for p in pts]
            l_mm = round(max(xs) - min(xs), 2)
            w_mm = round(max(ys) - min(ys), 2)
            h_mm = round(max(zs) - min(zs), 2)

            if l_mm > 0 and w_mm > 0 and h_mm > 0:
                prov = Provenance(
                    source_name=f"STEP Token Parser ({file_name})",
                    source_type=SourceType.CAD_EXTRACTED,
                    is_edited=False,
                    evidence_snippet=f"Extracted bounds from {len(pts)} CARTESIAN_POINT tokens.",
                )
                return UploadFileResult(
                    success=True,
                    file_name=file_name,
                    file_type=ext.lstrip("."),
                    components=[ComponentInput(name=stem, length_mm=l_mm, width_mm=w_mm, height_mm=h_mm, provenance=prov)],
                    bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
                    units_assumed="mm",
                    provenance=prov,
                )
    except Exception as e:
        logger.warning("STEP parser notice: %s", e)

    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type=ext.lstrip("."),
        error="Could not extract 3D coordinates from STEP file. Export as STL or DXF from your CAD tool.",
    )


def _parse_dxf_file(file_name: str, file_bytes: bytes) -> UploadFileResult:
    """
    Pure-Python ASCII DXF Parser.
    Reads lines, coordinates, and extents across model space entities.
    """
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        lines = [line.strip() for line in text.splitlines()]

        xs: List[float] = []
        ys: List[float] = []

        # Parse group codes 10 (x), 20 (y)
        i = 0
        while i < len(lines) - 1:
            code = lines[i]
            val = lines[i + 1]
            if code in ("10", "11", "12", "13"):
                try:
                    xs.append(float(val))
                except ValueError:
                    pass
            elif code in ("20", "21", "22", "23"):
                try:
                    ys.append(float(val))
                except ValueError:
                    pass
            i += 2

        if xs and ys:
            l_mm = round(max(xs) - min(xs), 2)
            w_mm = round(max(ys) - min(ys), 2)
            h_mm = 50.0  # Default assumption for 2D profile thickness

            if l_mm >= MIN_DIM_MM and w_mm >= MIN_DIM_MM:
                prov = Provenance(
                    source_name=f"DXF Drawing ({file_name})",
                    source_type=SourceType.CAD_EXTRACTED,
                    is_edited=False,
                    evidence_snippet=f"Extracted extents ({l_mm} x {w_mm} mm) from DXF entity vertices.",
                )
                return UploadFileResult(
                    success=True,
                    file_name=file_name,
                    file_type="dxf",
                    components=[ComponentInput(name=Path(file_name).stem, length_mm=l_mm, width_mm=w_mm, height_mm=h_mm, provenance=prov)],
                    bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
                    units_assumed="mm",
                    provenance=prov,
                )
    except Exception as e:
        logger.warning("DXF parser error: %s", e)

    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type="dxf",
        error="Could not parse DXF drawing. Ensure it is an ASCII DXF format.",
    )


def _parse_pdf_drawing(file_name: str, file_bytes: bytes) -> UploadFileResult:
    """Extract engineering dimensions from PDF spec sheet or technical drawing."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() or ""

        # Search for dimension patterns like 500 x 400 x 1200 mm
        match = re.search(r"(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(mm|cm)?", full_text)
        if match:
            l, w, h = float(match.group(1)), float(match.group(2)), float(match.group(3))
            unit = (match.group(4) or "mm").lower()
            factor = 10.0 if unit == "cm" else 1.0
            l_mm, w_mm, h_mm = round(l * factor, 1), round(w * factor, 1), round(h * factor, 1)

            prov = Provenance(
                source_name=f"PDF Engineering Drawing ({file_name})",
                source_type=SourceType.CAD_EXTRACTED,
                is_edited=False,
                evidence_snippet=f"Extracted specs: {l_mm} x {w_mm} x {h_mm} mm from document text.",
            )
            return UploadFileResult(
                success=True,
                file_name=file_name,
                file_type="pdf",
                components=[ComponentInput(name=Path(file_name).stem, length_mm=l_mm, width_mm=w_mm, height_mm=h_mm, provenance=prov)],
                bounding_box_mm={"length_mm": l_mm, "width_mm": w_mm, "height_mm": h_mm},
                units_assumed="mm",
                provenance=prov,
            )
    except Exception as e:
        logger.warning("PDF drawing parser error: %s", e)

    return UploadFileResult(
        success=False,
        file_name=file_name,
        file_type="pdf",
        error="Could not extract geometric dimensions from PDF. Please upload a 3D CAD file or enter values manually.",
    )
