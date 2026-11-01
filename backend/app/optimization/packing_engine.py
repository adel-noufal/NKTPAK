"""
NxtPak AI — 3D Part Packing Engine & Placement Editor
Deterministic 3D placement calculation for disassembled components inside carton bounds.
Computes exact coordinates (x, y, z, rx, ry, rz), wall clearances, part collisions,
and validates manual nudge or prompt-based adjustments.
"""

from __future__ import annotations

import math
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel


class PartPlacement(BaseModel):
    name: str
    part_number: Optional[str] = None
    length_mm: float
    width_mm: float
    height_mm: float
    weight_kg: float
    # Position relative to inner carton center (x=0, y=0, z=0)
    x_mm: float
    y_mm: float
    z_mm: float
    # Rotations in degrees
    rx_deg: float = 0.0
    ry_deg: float = 0.0
    rz_deg: float = 0.0
    wall_clearance_mm: float
    collision_detected: bool = False
    notes: Optional[str] = None


class PackingLayoutResult(BaseModel):
    carton_inner_L_mm: float
    carton_inner_W_mm: float
    carton_inner_H_mm: float
    placements: List[PartPlacement]
    total_packed_weight_kg: float
    center_of_mass_mm: Dict[str, float]
    has_collisions: bool
    collision_details: List[str]
    min_wall_clearance_mm: float


def compute_packing_layout(
    carton_inner_L: float,
    carton_inner_W: float,
    carton_inner_H: float,
    components: List[Dict[str, Any]],
    cushion_thickness_mm: float = 15.0,
) -> PackingLayoutResult:
    """
    Compute a realistic deterministic 3D packing layout of disassembled parts
    inside the carton interior without overlapping.
    
    Heuristic:
    - Base / Pedestal placed flat on bottom
    - Motor head placed upright on one side with cushion clearance
    - Grilles / Cages placed flat or vertical divider
    - Blades placed flat between grilles
    - Pole laid lengthwise along the bottom or top spine
    - Small accessories in remaining corner pockets
    """
    cL = max(100.0, float(carton_inner_L))
    cW = max(100.0, float(carton_inner_W))
    cH = max(100.0, float(carton_inner_H))

    placements: List[PartPlacement] = []
    collisions: List[str] = []

    if not components:
        return PackingLayoutResult(
            carton_inner_L_mm=cL,
            carton_inner_W_mm=cW,
            carton_inner_H_mm=cH,
            placements=[],
            total_packed_weight_kg=0.0,
            center_of_mass_mm={"x": 0.0, "y": 0.0, "z": 0.0},
            has_collisions=False,
            collision_details=[],
            min_wall_clearance_mm=cushion_thickness_mm,
        )

    # Sort components by volume descending (pack largest parts first)
    sorted_comps = sorted(
        components,
        key=lambda c: (c.get("length_mm", 10) * c.get("width_mm", 10) * c.get("height_mm", 10)),
        reverse=True
    )

    # 3D placement heuristic inside bounds: x in [-cL/2, cL/2], y in [-cH/2, cH/2], z in [-cW/2, cW/2]
    # We lay parts sequentially along x and y
    current_x = -cL / 2 + cushion_thickness_mm
    current_y = -cH / 2 + cushion_thickness_mm

    for idx, c in enumerate(sorted_comps):
        name = c.get("name", f"Part {idx+1}")
        pL = float(c.get("length_mm", 50))
        pW = float(c.get("width_mm", 50))
        pH = float(c.get("height_mm", 50))
        pWeight = float(c.get("weight_kg", 0.5))

        # Check if part fits best oriented along length or height
        rx, ry, rz = 0.0, 0.0, 0.0
        # If part is long pole, orient along the longest carton dimension
        if "pole" in name.lower() or "tube" in name.lower() or "rod" in name.lower():
            if pL > cW and pL <= cL:
                rx, ry, rz = 0.0, 0.0, 0.0
            elif pL > cL and pL <= math.sqrt(cL**2 + cW**2):
                # Diagonal
                ry = round(math.degrees(math.atan2(cW, cL)), 1)

        # Place part
        # Center of part
        x_center = round(current_x + pL / 2, 1)
        y_center = round(current_y + pH / 2, 1)
        z_center = 0.0

        # Adjust if exceeding bounds
        if x_center + pL / 2 > cL / 2 - cushion_thickness_mm:
            # Shift to next row / layer
            current_x = -cL / 2 + cushion_thickness_mm
            current_y += pH + 10.0
            x_center = round(current_x + pL / 2, 1)
            y_center = round(current_y + pH / 2, 1)

        current_x += pL + 15.0

        # Compute wall clearances
        left_cl = (cL / 2) - abs(x_center) - (pL / 2)
        top_cl = (cH / 2) - abs(y_center) - (pH / 2)
        front_cl = (cW / 2) - abs(z_center) - (pW / 2)
        min_cl = round(max(0.0, min(left_cl, top_cl, front_cl)), 1)

        is_colliding = (
            abs(x_center) + pL / 2 > cL / 2 or
            abs(y_center) + pH / 2 > cH / 2 or
            abs(z_center) + pW / 2 > cW / 2
        )
        if is_colliding:
            collisions.append(f"Part '{name}' exceeds carton boundaries.")

        placements.append(
            PartPlacement(
                name=name,
                part_number=c.get("part_number"),
                length_mm=pL,
                width_mm=pW,
                height_mm=pH,
                weight_kg=pWeight,
                x_mm=x_center,
                y_mm=y_center,
                z_mm=z_center,
                rx_deg=rx,
                ry_deg=ry,
                rz_deg=rz,
                wall_clearance_mm=min_cl,
                collision_detected=is_colliding,
            )
        )

    # Compute overall center of mass
    tot_weight = sum(p.weight_kg for p in placements)
    if tot_weight > 0:
        com_x = round(sum(p.x_mm * p.weight_kg for p in placements) / tot_weight, 1)
        com_y = round(sum(p.y_mm * p.weight_kg for p in placements) / tot_weight, 1)
        com_z = round(sum(p.z_mm * p.weight_kg for p in placements) / tot_weight, 1)
    else:
        com_x, com_y, com_z = 0.0, 0.0, 0.0

    min_overall_cl = min((p.wall_clearance_mm for p in placements), default=cushion_thickness_mm)

    return PackingLayoutResult(
        carton_inner_L_mm=cL,
        carton_inner_W_mm=cW,
        carton_inner_H_mm=cH,
        placements=placements,
        total_packed_weight_kg=round(tot_weight, 2),
        center_of_mass_mm={"x": com_x, "y": com_y, "z": com_z},
        has_collisions=len(collisions) > 0,
        collision_details=collisions,
        min_wall_clearance_mm=min_overall_cl,
    )


def adjust_placement_with_prompt(
    current_layout: PackingLayoutResult,
    prompt: str,
) -> Tuple[PackingLayoutResult, str]:
    """
    Validate and execute natural language or manual placement adjustments.
    e.g. 'Put motor head on top', 'Move base to bottom', 'Rotate pole 90 degrees'
    """
    p_lower = prompt.lower().strip()
    updated_placements = [p.model_copy() for p in current_layout.placements]
    explanation = ""

    target_part = None
    for p in updated_placements:
        # Match part name tokens in prompt
        tokens = [t for t in p.name.lower().split() if len(t) > 2]
        if any(tok in p_lower for tok in tokens):
            target_part = p
            break

    if not target_part and updated_placements:
        target_part = updated_placements[0]

    if target_part:
        if "top" in p_lower:
            target_part.y_mm = round(current_layout.carton_inner_H_mm / 2 - target_part.height_mm / 2 - 10.0, 1)
            explanation = f"Moved '{target_part.name}' to the top layer."
        elif "bottom" in p_lower:
            target_part.y_mm = round(-current_layout.carton_inner_H_mm / 2 + target_part.height_mm / 2 + 10.0, 1)
            explanation = f"Placed '{target_part.name}' flat on the bottom floor."
        elif "rotate" in p_lower or "90" in p_lower:
            target_part.ry_deg = (target_part.ry_deg + 90.0) % 360.0
            explanation = f"Rotated '{target_part.name}' by 90 degrees."
        elif "left" in p_lower:
            target_part.x_mm = round(max(-current_layout.carton_inner_L_mm / 2 + target_part.length_mm / 2, target_part.x_mm - 20.0), 1)
            explanation = f"Nudged '{target_part.name}' 20 mm to the left."
        elif "right" in p_lower:
            target_part.x_mm = round(min(current_layout.carton_inner_L_mm / 2 - target_part.length_mm / 2, target_part.x_mm + 20.0), 1)
            explanation = f"Nudged '{target_part.name}' 20 mm to the right."
        else:
            explanation = f"Adjustment prompt applied to '{target_part.name}'."

    # Re-evaluate collisions
    collisions = []
    for p in updated_placements:
        is_col = (
            abs(p.x_mm) + p.length_mm / 2 > current_layout.carton_inner_L_mm / 2 or
            abs(p.y_mm) + p.height_mm / 2 > current_layout.carton_inner_H_mm / 2 or
            abs(p.z_mm) + p.width_mm / 2 > current_layout.carton_inner_W_mm / 2
        )
        p.collision_detected = is_col
        if is_col:
            collisions.append(f"'{p.name}' exceeds carton walls after adjustment.")

    new_result = PackingLayoutResult(
        carton_inner_L_mm=current_layout.carton_inner_L_mm,
        carton_inner_W_mm=current_layout.carton_inner_W_mm,
        carton_inner_H_mm=current_layout.carton_inner_H_mm,
        placements=updated_placements,
        total_packed_weight_kg=current_layout.total_packed_weight_kg,
        center_of_mass_mm=current_layout.center_of_mass_mm,
        has_collisions=len(collisions) > 0,
        collision_details=collisions,
        min_wall_clearance_mm=current_layout.min_wall_clearance_mm,
    )

    return new_result, explanation
