# NxtPak AI — Production Release

**Intelligent Packaging Optimization — NXTPAK Hackathon (Egypt), El Araby Group Challenge**

> Recommend right-sized packaging, preview in interactive 3D, calculate McKee box compression strength, optimize Euro pallet stacking, and evaluate against a built-in ISO packaging standards registry — without compromising product protection.

---

## Production Capabilities

| Capability | Status |
|---|---|
| **Empty Database Guarantee** | ✅ Ships with empty database (`0` rows). Zero fake seed projects or mock responses. |
| **Full Data Provenance** | ✅ Explicit provenance badges on all fields (`fetched`, `user-entered`, `cad-extracted`, `ai-estimated`). |
| **Real Live Dynamic AI Fetch** | ✅ Real query pipeline, brand dropdown, direct URL fetching, SSRF protection, SQLite runtime caching. |
| **Fuzzy Typo Correction** | ✅ Suggests exact matches via Levenshtein distance (e.g. `tsd-16w` → *"Did you mean TSF-16W?"*). |
| **Side-by-Side Candidate Picker** | ✅ Multi-candidate card comparison with confidence scores and source URLs. |
| **Duplicate Product Detection** | ✅ Uniqueness check on `(brand, model, sku)` with friendly warning and variant options. |
| **Strict Form Validation** | ✅ Client & server validation for all required fields (weight > 0, L×W×H, baseline carton, flute, unit cost, units/pallet). |
| **McKee Compression Formula** | ✅ Real Box Compression Strength \(BCT = 5.876 \times ECT \times \sqrt{U \times d}\), safety factor 4.5, and max stack layers. |
| **Euro Pallet Optimization** | ✅ Standard 1200×800 mm pallet layer layout with carton orientation comparison and area utilization %. |
| **3D / CAD File Extractor** | ✅ STL, OBJ, 3MF, GLB, STEP, STP, DXF, and PDF drawings; extracts bounding box, volume, area, and watertightness. |
| **FEFCO 0201 DXF Dieline** | ✅ Generates sample-maker DXF files with separated `CUT` and `CREASE` layers. |
| **Interactive 3D Workspace** | ✅ Exterior box, Interior product & cushion fit, wireframe toggle, camera angle presets. |
| **ISO Standards Registry v1** | ✅ 16 international packaging standards. Honest evaluation: physical tests never return software PASS. |
| **Real AI Assistant & Tool Calling** | ✅ Anthropic Claude (default), Gemini, and OpenAI configurable via Settings or `.env`. Tool calling executes real engineering calculations. |
| **Free-Text AI Extraction** | ✅ Large "Describe your project" prompt box on NewProject screen; parses product specs into structured fields with model enrichment. |
| **Live Model Discovery** | ✅ Real-time model listing (`/api/v1/llm-models`) with Gemini `x-goog-api-key` header integration and latency connection testing. |
| **Test DB Isolation** | ✅ Pytest suite runs against isolated `test_nxtpak.db`, guaranteeing production `nxtpak.db` remains 0 rows. |
| **Navbar Assistant Drawer** | ✅ Collapsible slide-in drawer replacing floating bubbles, with quick engineering action prompts. |
| **Warm Tone Aesthetic** | ✅ Warm paper light mode & warm charcoal dark mode with clean line icons (no cartoon mascots or robots). |
| **Multilingual & Theming** | ✅ Complete English (LTR) and Arabic (العربية - RTL) support with Light and Dark themes. |

---

## Production Architecture

```
NxtPak/
├── frontend/          React 18 + TypeScript strict + Vite + Tailwind CSS + React Three Fiber
├── backend/           Python 3.11+ + FastAPI + Pydantic v2 + SQLAlchemy 2.x
├── data/
│   └── standards/     iso_registry.json  (16 ISO packaging standards metadata)
└── docs/              Architecture, standards documentation, decisions log
```

- **Database:** SQLite (`nxtpak.db`) initialized with empty tables. Runtime caching table `product_cache` handles live URL queries with TTL.
- **Geometry Engine:** `trimesh` with parametric box and cushion generation.
- **LLM Provider:** Anthropic Claude (default), Google Gemini, or OpenAI. If no key is set, the assistant returns an honest offline notice linking to Settings.

---

## Quick Start

### 1 — Backend Setup

```powershell
# Windows (PowerShell)
cd d:\Adel\Projects\NxtPak\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

```bash
# macOS / Linux
cd /path/to/NxtPak/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2 — Frontend Setup

```powershell
# Windows (PowerShell)
cd d:\Adel\Projects\NxtPak\frontend
pnpm install
pnpm dev
```

```bash
# macOS / Linux
cd /path/to/NxtPak/frontend
pnpm install
pnpm dev
```

Frontend runs at **http://localhost:5173**.

---

## Running Automated Tests

### Backend Test Suite (32 tests)

```powershell
cd d:\Adel\Projects\NxtPak\backend
python -m pytest tests -v
```

### Frontend Test Suite & Production Build

```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm test
pnpm run build
```

---

## ISO Standards Registry Rules

1. **No Standard Text Reproduction:** Stores identifier, title, edition, own-words scope summary, check type, and source URL.
2. **Check Types:** `PROGRAMMATIC`, `PHYSICAL_TEST`, and `HUMAN_REVIEW`.
3. **Physical-test standards NEVER return `PASS` from software.** Software PASS is not an ISO compliance certificate.
4. **All clearances are user-editable engineering assumptions** and are labeled `ENGINEERING_ASSUMPTION`.

---

*NxtPak AI — El Araby Group Packaging Optimization Challenge*
