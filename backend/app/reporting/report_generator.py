"""
NxtPak AI — Report Generator
Generates valid PDF (ReportLab), HTML (Jinja2), and JSON engineering reports.
Always includes disclaimer, evaluation statement, formula documentation, and data provenance.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from jinja2 import Template

logger = logging.getLogger(__name__)

DISCLAIMER_TEXT = (
    "A software PASS is never proof of ISO certification or of successful physical testing. "
    "All packaging geometry and savings estimates are preliminary engineering prototypes. "
    "Physical testing (drop, compression, vibration, environmental) in an accredited laboratory "
    "is strictly required before commercial production."
)

EVALUATION_STATEMENT = (
    "Evaluated against: NxtPak ISO registry v1 (see source list). "
    "No company-specific requirements loaded."
)

HTML_REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NxtPak AI — Packaging Optimization Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; background: #fff; line-height: 1.5; }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { color: #0f172a; margin: 0 0 8px 0; font-size: 26px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge-prototype { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-review { background: #fef9c3; color: #854d0e; }
    .badge-test { background: #e0f2fe; color: #075985; }
    .section { margin-bottom: 32px; }
    h2 { font-size: 18px; color: #1e3a8a; border-left: 4px solid #3b82f6; padding-left: 10px; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; color: #334155; }
    .formula-box { background: #f1f5f9; border-left: 3px solid #64748b; padding: 12px; font-family: monospace; font-size: 13px; margin: 8px 0; }
    .disclaimer-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; color: #92400e; margin-top: 30px; font-size: 13px; }
    .footer { font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>NxtPak AI — Packaging Optimization Report</h1>
      <span class="badge badge-prototype">PRELIMINARY GEOMETRIC PROTOTYPE</span>
      <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Project: <strong>{{ project_name }}</strong> | Generated: {{ generated_at }}</p>
    </div>
    <div style="text-align: right; font-size: 13px; color: #64748b;">
      NXTPAK Hackathon (Egypt)<br>
      El Araby Group Challenge
    </div>
  </div>

  <div class="section">
    <h2>1. Product Specifications</h2>
    <table>
      <tr><th>Property</th><th>Value</th><th>Data Provenance / Label</th></tr>
      <tr><td>Product Name</td><td>{{ product.name }}</td><td>{{ product.provenance.data_label or 'USER_ENTERED' }}</td></tr>
      <tr><td>Dimensions (L × W × H)</td><td>{{ product.dims_mm.L }} × {{ product.dims_mm.W }} × {{ product.dims_mm.H }} mm</td><td>{{ product.provenance.data_label or 'USER_ENTERED' }}</td></tr>
      <tr><td>Product Volume</td><td>{{ product.volume_mm3 | round(1) }} mm³</td><td>CALCULATED</td></tr>
      <tr><td>Packed Weight</td><td>{{ product.weight_kg }} kg</td><td>USER_ENTERED</td></tr>
      <tr><td>Fragility Class</td><td>{{ product.fragility_class }}</td><td>USER_ENTERED (Engineering selection)</td></tr>
    </table>
  </div>

  {% if baseline %}
  <div class="section">
    <h2>2. Baseline Packaging (Current)</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Outer Dimensions</td><td>{{ baseline.carton_outer_length_mm }} × {{ baseline.carton_outer_width_mm }} × {{ baseline.carton_outer_height_mm }} mm</td></tr>
      <tr><td>Board Thickness & Type</td><td>{{ baseline.board_thickness_mm }} mm ({{ baseline.board_type or 'Standard corrugated' }})</td></tr>
      <tr><td>Unit Cost</td><td>{{ baseline.carton_cost_per_unit or 'NOT_CONFIGURED' }} {{ baseline.currency or '' }}</td></tr>
      <tr><td>Data Label</td><td><span class="badge" style="background:#e0e7ff;color:#3730a3;">{{ baseline.data_label or 'USER_ENTERED' }}</span></td></tr>
    </table>
  </div>
  {% endif %}

  <div class="section">
    <h2>3. Packaging Alternatives Comparison</h2>
    <div class="formula-box">
      • Volume Utilization = Product Volume [mm³] / Internal Packaging Volume [mm³]<br>
      • Material Saved (%) = (Baseline Volume − Proposed Volume) / Baseline Volume × 100<br>
      • Cost Saved = Baseline Unit Cost − Proposed Unit Cost
    </div>
    <table>
      <thead>
        <tr>
          <th>Alternative</th>
          <th>Outer Dims (mm)</th>
          <th>Clearance</th>
          <th>Inserts</th>
          <th>Vol. Util.</th>
          <th>Material Vol.</th>
          <th>Savings vs Baseline</th>
          <th>Rank</th>
        </tr>
      </thead>
      <tbody>
        {% for alt in alternatives %}
        <tr {% if alt.rank == 'RECOMMENDED' %}style="background: #eff6ff;"{% endif %}>
          <td><strong>{{ alt.name }}</strong></td>
          <td>{{ alt.outer_length_mm }} × {{ alt.outer_width_mm }} × {{ alt.outer_height_mm }}</td>
          <td>{{ alt.clearance_length_mm }} mm</td>
          <td>{{ alt.insert_description }}</td>
          <td>{{ alt.savings.volume_utilization_pct }}%</td>
          <td>{{ alt.material_usage.total_material_volume_cm3 }} cm³</td>
          <td>
            {% if alt.savings.savings_status == 'CALCULATED' %}
              <strong>{{ alt.savings.material_saved_pct }}%</strong> material
              {% if alt.savings.cost_saved is not none %}
                <br>({{ alt.savings.cost_saved }} {{ alt.savings.currency }})
              {% endif %}
            {% else %}
              <span style="color:#64748b;">NOT_CONFIGURED</span>
            {% endif %}
          </td>
          <td>
            {% if alt.rank == 'RECOMMENDED' %}
              <span class="badge badge-pass">RECOMMENDED</span>
            {% else %}
              <span class="badge" style="background:#f1f5f9;color:#475569;">ALTERNATIVE</span>
            {% endif %}
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>4. ISO Standards Registry Evaluation</h2>
    <p style="font-size: 13px; color: #475569; margin-top: 4px;">
      <em>{{ evaluation_statement }}</em>
    </p>
    <table>
      <thead>
        <tr>
          <th>Standard ID</th>
          <th>Title</th>
          <th>Check Type</th>
          <th>Status</th>
          <th>Details & Remaining Steps</th>
        </tr>
      </thead>
      <tbody>
        {% for std in standards_results %}
        <tr>
          <td><strong>{{ std.standard_identifier }}</strong></td>
          <td style="font-size: 13px;">{{ std.title }}</td>
          <td><span class="badge" style="background:#f3e8ff;color:#6b21a8;">{{ std.check_type }}</span></td>
          <td>
            {% if std.status == 'PASS' %}
              <span class="badge badge-pass">PASS</span>
            {% elif std.status == 'FAIL' %}
              <span class="badge badge-fail">FAIL</span>
            {% elif std.status == 'NOT_VERIFIABLE' %}
              <span class="badge badge-test">PHYSICAL TEST</span>
            {% elif std.status == 'NEEDS_REVIEW' %}
              <span class="badge badge-review">NEEDS REVIEW</span>
            {% else %}
              <span class="badge" style="background:#f1f5f9;color:#64748b;">NOT CONFIG</span>
            {% endif %}
          </td>
          <td style="font-size: 12px;">
            {{ std.details }}
            {% if std.what_is_still_required %}
              <ul style="margin: 4px 0 0 0; padding-left: 16px; color: #64748b;">
                {% for req in std.what_is_still_required %}
                  <li>{{ req }}</li>
                {% endfor %}
              </ul>
            {% endif %}
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>

  <div class="disclaimer-box">
    <strong>Mandatory Engineering Disclaimer:</strong><br>
    {{ disclaimer }}
  </div>

  <div class="footer">
    Report generated by NxtPak AI Engine v1.0. Active Geometry Engine: {{ active_geometry_engine }}.
  </div>

</body>
</html>
"""


class ReportGenerator:
    """Generates PDF, HTML, and JSON reports."""

    def __init__(self, output_dir: str = "./exports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_html(self, project_data: dict[str, Any], file_name: Optional[str] = None) -> str:
        """Render self-contained HTML report."""
        template = Template(HTML_REPORT_TEMPLATE)
        fname = file_name or f"nxtpak_report_{project_data.get('project_id', 'draft')}.html"
        file_path = self.output_dir / fname

        rendered = template.render(
            project_name=project_data.get("name", "NxtPak Project"),
            generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            product=project_data.get("normalized_product", {}),
            baseline=project_data.get("baseline_data"),
            alternatives=project_data.get("optimization_result", {}).get("alternatives", []),
            standards_results=project_data.get("standards_result", {}).get("results", []),
            evaluation_statement=EVALUATION_STATEMENT,
            disclaimer=DISCLAIMER_TEXT,
            active_geometry_engine=project_data.get("active_geometry_engine", "trimesh"),
        )

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(rendered)

        logger.info("HTML report generated at: %s", file_path)
        return str(file_path)

    def generate_json(self, project_data: dict[str, Any], file_name: Optional[str] = None) -> str:
        """Export full project data & standards report as JSON."""
        fname = file_name or f"nxtpak_project_{project_data.get('project_id', 'draft')}.json"
        file_path = self.output_dir / fname

        payload = {
            "report_metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "generator": "NxtPak AI v1.0",
                "label": "PRELIMINARY GEOMETRIC PROTOTYPE",
                "disclaimer": DISCLAIMER_TEXT,
                "evaluation_statement": EVALUATION_STATEMENT,
            },
            "project": project_data,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)

        logger.info("JSON report generated at: %s", file_path)
        return str(file_path)

    def generate_pdf(self, project_data: dict[str, Any], file_name: Optional[str] = None) -> str:
        """Generate PDF report using ReportLab."""
        fname = file_name or f"nxtpak_report_{project_data.get('project_id', 'draft')}.pdf"
        file_path = self.output_dir / fname

        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(
            str(file_path),
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
        )
        sub_style = ParagraphStyle(
            "DocSub",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=12,
        )
        h2_style = ParagraphStyle(
            "DocH2",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#1e3a8a"),
            spaceBefore=10,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#1e293b"),
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#92400e"),
        )

        elements = []

        # Header
        elements.append(Paragraph("NxtPak AI — Packaging Optimization Report", title_style))
        proj_name = project_data.get("name", "Project")
        elements.append(
            Paragraph(
                f"<b>Project:</b> {proj_name} | <b>Label:</b> PRELIMINARY GEOMETRIC PROTOTYPE | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
                sub_style,
            )
        )
        elements.append(Spacer(1, 10))

        # 1. Product specs
        elements.append(Paragraph("1. Product Specifications", h2_style))
        norm_p = project_data.get("normalized_product", {})
        dims = norm_p.get("dims_mm", {})
        prod_table_data = [
            ["Item", "Value", "Provenance / Label"],
            ["Product Name", norm_p.get("name", "N/A"), "USER_ENTERED"],
            [
                "Dimensions (L × W × H)",
                f"{dims.get('L', 0)} × {dims.get('W', 0)} × {dims.get('H', 0)} mm",
                "USER_ENTERED",
            ],
            ["Packed Weight", f"{norm_p.get('weight_kg', 0)} kg", "USER_ENTERED"],
            ["Fragility Class", norm_p.get("fragility_class", "MEDIUM"), "Engineering Selection"],
        ]
        t_prod = Table(prod_table_data, colWidths=[150, 180, 200])
        t_prod.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#334155")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(t_prod)
        elements.append(Spacer(1, 12))

        # 2. Alternatives Comparison
        elements.append(Paragraph("2. Packaging Alternatives Comparison", h2_style))
        alt_data = [
            ["Alternative", "Outer Dims (mm)", "Clearance", "Vol. Util", "Material", "Rank"]
        ]
        alts = project_data.get("optimization_result", {}).get("alternatives", [])
        for a in alts:
            alt_data.append(
                [
                    a.get("name", ""),
                    f"{a.get('outer_length_mm')}×{a.get('outer_width_mm')}×{a.get('outer_height_mm')}",
                    f"{a.get('clearance_length_mm')} mm",
                    f"{a.get('savings', {}).get('volume_utilization_pct', 0)}%",
                    f"{a.get('material_usage', {}).get('total_material_volume_cm3', 0)} cm³",
                    a.get("rank", ""),
                ]
            )
        t_alts = Table(alt_data, colWidths=[120, 120, 70, 70, 80, 70])
        t_alts.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(t_alts)
        elements.append(Spacer(1, 12))

        # 3. Standards
        elements.append(Paragraph("3. ISO Standards Evaluation Summary", h2_style))
        elements.append(Paragraph(f"<i>{EVALUATION_STATEMENT}</i>", sub_style))
        std_data = [["Standard", "Check Type", "Status", "Evaluation Note"]]
        std_results = project_data.get("standards_result", {}).get("results", [])
        for s in std_results[:8]:  # Top entries for concise page fitting
            std_data.append(
                [
                    s.get("standard_identifier", ""),
                    s.get("check_type", ""),
                    s.get("status", ""),
                    Paragraph(s.get("details", "")[:120], body_style),
                ]
            )
        t_std = Table(std_data, colWidths=[90, 80, 90, 270])
        t_std.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(t_std)
        elements.append(Spacer(1, 14))

        # 4. Mandatory Disclaimer
        elements.append(Paragraph("<b>Mandatory Engineering Disclaimer:</b>", h2_style))
        elements.append(Paragraph(DISCLAIMER_TEXT, disclaimer_style))

        doc.build(elements)
        logger.info("PDF report generated at: %s", file_path)
        return str(file_path)
