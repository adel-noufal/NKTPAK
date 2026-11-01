# Export verification

Exports were downloaded from the running FastAPI service for the existing project `badc4582-a74a-441a-819e-bbb3e49c8601`.

| Format | Size | Verification |
| --- | ---: | --- |
| PDF | 5,023 bytes | First page rendered to `proof-pdf-page.png` with `pdftoppm` |
| HTML | 28,594 bytes | Standalone HTML document downloaded |
| DXF | 1,562 bytes | Contains CUT and CREASE layers; dieline extents are 1,253 × 819 mm, computed from the selected 312 × 297 × 522 mm carton and 35 mm glue flap |
| JSON | 59,742 bytes | Parsed successfully with Python `json.tool` |

With the backend stopped, `GET /api/health` failed to connect as expected. No CAD viewer or browser executable was installed in this environment, so the DXF was not opened in a CAD application and no browser UI screenshot could be captured.
