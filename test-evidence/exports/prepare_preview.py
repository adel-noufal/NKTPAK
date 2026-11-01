from pathlib import Path
import json
import re

root = Path(__file__).parent
dxf = (root / "repaired-project.dxf").read_text(encoding="ascii")
lines = re.findall(
    r"0\r?\nLINE\r?\n8\r?\n(CUT|CREASE)\r?\n10\r?\n([-0-9.]+)\r?\n20\r?\n([-0-9.]+).*?11\r?\n([-0-9.]+)\r?\n21\r?\n([-0-9.]+)",
    dxf,
    re.S,
)
drawn = "".join(
    f'<line x1="{x1}" y1="{819 - float(y1)}" x2="{x2}" y2="{819 - float(y2)}" '
    f'stroke="{"#dc2626" if layer == "CUT" else "#2563eb"}" stroke-width="2"/>'
    for layer, x1, y1, x2, y2 in lines
)
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" '
    'viewBox="-10 -100 1273 950"><rect x="-10" y="-100" width="1273" '
    'height="950" fill="white"/><text x="0" y="-50" font-size="28">'
    'DXF dieline: 1253 x 819 mm (red CUT, blue CREASE)</text>'
    f"{drawn}</svg>"
)
(root / "repaired-project-dxf-preview.svg").write_text(svg, encoding="utf-8")

payload = json.loads((root / "repaired-project.json").read_text(encoding="utf-8"))
project_summary = {
    "project": payload["project"]["name"],
    "product_dimensions_mm": payload["project"]["normalized_product"]["packed_dimensions"],
    "suggested_validation_tests": payload["project"]["suggested_validation_tests"],
}
(root / "repaired-project-json-preview.html").write_text(
    '<!doctype html><meta charset="utf-8"><title>Valid JSON export</title>'
    '<style>body{font:14px system-ui;margin:32px;background:#111827;color:#e5e7eb}'
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#030712;padding:24px}</style>'
    '<h1>Parsed JSON export</h1><p>JSON.parse succeeded</p><pre>'
    + json.dumps(project_summary, indent=2, ensure_ascii=False)
    + "</pre>",
    encoding="utf-8",
)
print(f"DXF lines parsed: {len(lines)}; JSON project: {payload['project']['name']}")
