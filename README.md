# NxtPak AI — Production Release

**Intelligent Packaging Optimization — NXTPAK Hackathon (Egypt), El Araby Group Challenge**

> Recommend right-sized packaging, preview product fit in interactive 3D, calculate McKee box compression strength, optimize Euro pallet stacking, and consult database-backed ISO and ISTA registries — without compromising product protection.

---

## Production Capabilities

| Capability | Status |
|---|---|
| **No Fake Seed Projects** | ✅ Ships without sample project rows; standards metadata is seeded from the maintained ISO/ISTA registry files. |
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
| **Interactive 3D Workspace** | ✅ Box, Inside, Product Alone, Exploded, and Packed Parts views; dimensions and clearances measured from scene bounds. |
| **Product Models** | ✅ Saved product type selects its deterministic model. CAD source is distinguished from approximate and generic geometry. |
| **ISO + ISTA Standards Registry** | ✅ Database-backed catalog with filters, project applicability, and suggested physical tests. Physical tests never return software PASS. |
| **Backend Health** | ✅ `/api/health` status, retry action, and backend-dependent action state. |
| **Exports** | ✅ PDF, standalone HTML, JSON, and FEFCO 0201 DXF with missing-data validation. |
| **Real AI Assistant & Tool Calling** | ✅ Anthropic Claude (default), Gemini, and OpenAI configurable via Settings or `.env`. Tool calling executes real engineering calculations. |
| **Free-Text AI Extraction** | ✅ Large "Describe your project" prompt box on NewProject screen; parses product specs into structured fields with model enrichment. |
| **Live Model Discovery** | ✅ Real-time model listing (`/api/v1/llm-models`) with Gemini `x-goog-api-key` header integration and latency connection testing. |
| **Test DB Isolation** | ✅ Pytest uses isolated `test_nxtpak.db`; tests do not alter the local project database. |
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
│   └── standards/     ISO + ISTA registry metadata
└── docs/              Architecture, standards documentation, decisions log
```

- **Database:** SQLite project tables contain no fabricated seed projects; standards metadata is seeded separately. Runtime caching table `product_cache` handles live URL queries with TTL.
- **Geometry Engine:** `trimesh` with parametric geometry; 3D scenes use millimetres, Y up, X length, Z width. Product placement and dimension panels use measured `THREE.Box3` bounds.
- **LLM Provider:** Anthropic Claude (default), Google Gemini, or OpenAI. If no key is set, the assistant returns an honest offline notice linking to Settings.

---

## Quick Start

### Start backend and frontend together

Install backend dependencies once using the backend setup below, then run:

```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm install
pnpm dev:all
```

`dev:all` starts both services, polls `/api/health`, and reports startup failures. The frontend defaults to `http://127.0.0.1:8000`; set `VITE_API_URL` to override it.

### 1 — Backend Setup (manual / first-time installation)

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

- API Base URL: `http://127.0.0.1:8000` (override with `VITE_API_URL`)
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

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

## Running Automated Tests and Checks

### Backend test suite

```powershell
cd d:\Adel\Projects\NxtPak\backend
python -m pytest tests/ -v
```

### Frontend Test Suite & Production Build

```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

---

## ISO and ISTA Registry Rules

1. **No Standard Text Reproduction:** Stores identifier, title, edition, original scope summary, check type, applicability, verification date, and source URL.
2. **Check Types:** `PROGRAMMATIC`, `PHYSICAL_TEST`, and `HUMAN_REVIEW`.
3. **Physical-test standards NEVER return `PASS` from software.** Software PASS is not an ISO compliance certificate.
4. **All clearances are user-editable engineering assumptions** and are labeled `ENGINEERING_ASSUMPTION`.
5. ISTA suggestions do not invent test levels. When shipping mode is unknown, the application asks for it instead of guessing a procedure.
6. Registry banners and report statements are derived from the database catalog and include ISO/ISTA counts and verification date.

See [the ISTA official procedures listing](https://ista.org/test_procedures.php) for current procedure information. App summaries are guidance; use the current official procedure for testing.

---

*NxtPak AI — El Araby Group Packaging Optimization Challenge*
