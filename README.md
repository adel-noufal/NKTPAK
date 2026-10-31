# NxtPak AI

**Intelligent Packaging Optimization — NXTPAK Hackathon (Egypt), El Araby Group Challenge**

> Recommend right-sized packaging, preview it in interactive 3D, calculate real material and cost savings, and evaluate against an ISO packaging standards registry — without lowering protection.

---

## What It Does

| Capability | Status |
|---|---|
| Manual product dimension entry (L×W×H, weight, fragility) | ✅ Implemented |
| Baseline packaging entry (carton, optional board thickness, costs) | ✅ Implemented |
| 2–3 deterministic packaging alternatives + recommendation | ✅ Implemented |
| Interactive 3D viewer — Box, Inside the box & Product alone views | ✅ Implemented |
| Side-by-side comparison (Actual baseline / My plan / Proposed) | ✅ Implemented |
| Material usage & cost savings vs baseline with transparent formulas | ✅ Implemented |
| ISO packaging standards registry (16 standards) | ✅ Implemented |
| El Araby product fetch service (TSF-16W & BL500/2 offline fixtures) | ✅ Implemented |
| 3D / CAD file upload (STL, OBJ, GLB, STEP, DXF; honest DWG message) | ✅ Implemented |
| Page-aware AI assistant (offline rule-based + optional Gemini LLM) | ✅ Implemented |
| Light, dark, and system theme switching | ✅ Implemented |
| PDF / HTML / JSON report export | ✅ Implemented |
| Arabic (RTL) + English UI | ✅ Implemented |
| Save & reopen projects (SQLite) | ✅ Implemented |
| Real El Araby reference products (TSF-16W fan, BL500/2 blender) | ✅ Implemented |

---

## Architecture

```
NxtPak/
├── frontend/          React 18 + TypeScript + Vite + Tailwind + React Three Fiber
├── backend/           Python 3.11+ + FastAPI + Pydantic v2 + SQLAlchemy 2
├── data/
│   ├── standards/     iso_registry.json  (16 ISO packaging standards, metadata only)
│   └── product_examples/  3 labeled example projects
└── docs/              Architecture, standards docs, decisions log
```

**Geometry engine:** `trimesh` (active) → falls back to `numpy_only` if trimesh unavailable.  
**Interactive 3D Viewer:** React Three Fiber / Three.js featuring Exterior box, Interior translucent product & cushion fit, wireframe/solid toggle, and 3D / Front / Top view angle presets.  
**LLM:** Optional. Disabled by default — all core features work with no API key.  
**Database:** SQLite (`nxtpak.db`) via SQLAlchemy 2 — zero external database infrastructure required.  
**UI & Internationalization:** English (LTR) and Arabic (العربية - RTL) with instant layout switching.

---

## Prerequisites

| Tool | Version | Required |
|---|---|---|
| Python | 3.11+ | Backend |
| Node.js | 18+ | Frontend |
| pnpm | 8+ | Frontend |
| git | any | optional |

---

## Quick Start

### 1 — Clone / enter the project

```powershell
# Windows (PowerShell)
cd d:\Adel\Projects\NxtPak
```

```bash
# macOS / Linux
cd /path/to/NxtPak
```

---

### 2 — Backend

#### Windows (PowerShell)
```powershell
cd d:\Adel\Projects\NxtPak\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

#### macOS / Linux
```bash
cd /path/to/NxtPak/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

---

### 3 — Frontend

#### Windows (PowerShell)
```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm install
pnpm dev
```

#### macOS / Linux
```bash
cd /path/to/NxtPak/frontend
pnpm install
pnpm dev
```

Frontend runs at **http://localhost:5173**

---

## Running Tests

### Backend
```powershell
cd d:\Adel\Projects\NxtPak\backend
# Activate venv first if not already active
.\venv\Scripts\Activate.ps1
pytest tests/ -v
```

```bash
# macOS / Linux
source venv/bin/activate
pytest tests/ -v
```

### Frontend
```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm test
```

---

## Environment Configuration

Copy `backend/.env.example` to `backend/.env`. All settings have safe defaults.

```env
# Geometry engine (trimesh preferred, numpy_only as fallback)
GEOMETRY_ENGINE=trimesh

# Packaging clearance defaults (mm)
DEFAULT_CLEARANCE_MM=20.0
DEFAULT_BOARD_THICKNESS_MM=4.0
DEFAULT_INSERT_THICKNESS_MM=25.0

# LLM — OPTIONAL. Leave empty; core features work without it.
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

> **Never commit your `.env` file.** It is already in `.gitignore`.

---

## ISO Standards Registry

The built-in registry (`data/standards/iso_registry.json`) contains **16 ISO packaging standards**:

| Category | Standards |
|---|---|
| Packaging optimization | ISO 18602:2013, ISO 18601:2013 |
| Test planning & conditioning | ISO 4180:2009, ISO 2233:2000, ISO 2206:1987 |
| Mechanical hazard tests | ISO 2248:1985, ISO 2244:2000, ISO 8768:1987, ISO 2234:2000, ISO 12048:1994, ISO 2247:2000, ISO 8318:2000, ISO 13355:2016 |
| Environmental exposure | ISO 2875:2000 |
| Dimensions | ISO 3676:2012, ISO 3394:2012 |

**Check types:**
- `PROGRAMMATIC` — software computes it (volume utilization, material savings, dimension fit)
- `PHYSICAL_TEST` — requires lab/factory testing; **never shows PASS from software**
- `HUMAN_REVIEW` — requires engineering judgment

> **Disclaimer:** A software PASS is never proof of ISO certification.  
> All reports state: *"Evaluated against: NxtPak ISO registry v1. No company-specific requirements loaded."*

You can import additional requirements (company or user-entered) via JSON:
```bash
POST /api/v1/standards/import   (body: JSON file with source_type: OFFICIAL_COMPANY or USER_ENTERED)
```

---

## Data Labels

Every value in the system carries one of these labels:

| Label | Meaning |
|---|---|
| `SAMPLE DATA` | Fabricated for demonstration |
| `PUBLIC RETAIL DATA - UNVERIFIED` | From public retail pages; product vs carton not confirmed |
| `USER ENTERED` | Provided by the user; not independently verified |
| `UNVERIFIED` | Source exists but data not confirmed |
| `ESTIMATE` | Calculated approximation; not measured |
| `VERIFIED` | Confirmed from an authoritative source |

---

## Example Projects

Three labeled example projects are included:

| Example | Label | Description |
|---|---|---|
| Toshiba-Type Stand Fan | `PUBLIC RETAIL DATA - UNVERIFIED` | Reference for a stand fan; dims from public retail — product vs carton not confirmed |
| Generic Stand Fan | `SAMPLE DATA` | Fabricated sample for demonstration |
| Generic Table Blender (4 parts) | `SAMPLE DATA` | 4-component blender; user defines part dimensions |

Load them from the Dashboard or via `GET /api/v1/examples`.

---

## Key Metrics & Formulas

All formulas are shown in reports:

```
Volume utilization   = product_volume_mm³ / packaging_internal_volume_mm³
Material area        = 2 × (L×W + L×H + W×H)  [outer carton, cm²]
Material saved (%)   = (baseline_usage − proposed_usage) / baseline_usage × 100
Cost saved           = baseline_cost_per_unit − proposed_cost_per_unit
```

> Savings are only computed when a baseline is entered. Without a baseline, savings show as `NOT_CONFIGURED`.

---

## Current Limitations (Milestone 1)

- Multi-component packing arrangement (blender 4 parts) planned for Milestone 2 — currently modeled as a single bounding box
- GLB/GLTF 3D export: geometry prepared but file download deferred to Milestone 2
- STEP / DXF upload: Milestone 2
- LLM natural language input: Milestone 3
- ISO numeric test parameters (drop heights, loads, etc.) must be entered by the user; software has no defaults
- All 3D results are **geometric estimates only** — physical testing is always required
- No El Araby Group company-specific requirements loaded (not publicly available)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| 3D Viewer | React Three Fiber, Three.js |
| State | Zustand, React Query |
| i18n | react-i18next (English + Arabic RTL) |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Database | SQLite (aiosqlite, SQLAlchemy 2 async) |
| Geometry | trimesh 5.x (fallback: numpy-only) |
| Reports | ReportLab (PDF), Jinja2 (HTML) |
| Tests | pytest, pytest-asyncio, Vitest |

---

## Project Structure

```
NxtPak/
├── frontend/
│   └── src/
│       ├── api/           API client and endpoint functions
│       ├── components/    Reusable UI components
│       │   ├── common/    Badges, spinners, empty states
│       │   ├── layout/    Sidebar, layout wrapper
│       │   ├── viewer/    PackagingViewer3D (React Three Fiber)
│       │   ├── optimization/  AlternativeCard, ComparisonTable
│       │   └── standards/ StandardsTable
│       ├── i18n/          en.json, ar.json, i18n config
│       ├── pages/         Dashboard, NewProject, ProjectDetail, Standards, Settings
│       ├── store/         Zustand global state
│       └── types/         TypeScript interfaces
├── backend/
│   └── app/
│       ├── api/v1/        FastAPI routers and endpoints
│       ├── agents/        Orchestrator, ProductSpecsAgent
│       ├── core/          Config, database
│       ├── exports/       File export coordinator
│       ├── geometry/      Engine interface (trimesh / numpy fallback)
│       ├── models/        SQLAlchemy ORM models
│       ├── optimization/  Deterministic packaging engine
│       ├── reporting/     PDF, HTML, JSON report generator
│       ├── schemas/       Pydantic schemas
│       ├── services/      Project CRUD service
│       ├── standards/     ISO registry loader and checker
│       └── validation/    Input and output validators
├── data/
│   ├── standards/         iso_registry.json (16 ISO standards, metadata only)
│   └── product_examples/  3 example projects (labeled)
├── docs/
│   ├── architecture/      System design, decisions log
│   ├── standards/         Standards registry documentation
│   └── demo-script.md     Hackathon demo flow
├── AGENTS.md              AI agent guidelines and constraints
├── .env.example           Environment variable template
├── .gitignore
├── README.md              ← this file
└── project-plan.md        Milestone status and roadmap
```

---

## Contributing / Development Rules

See [AGENTS.md](./AGENTS.md) for the full list of coding conventions and constraints.

**Short version:**
1. Never hardcode ISO numeric test parameters
2. Never generate compliance certificates
3. Never present SAMPLE DATA as real El Araby data
4. Every button either works or is marked "Planned"
5. All formulas shown in reports
6. Physical-test standards never return PASS from software

---

## License

Internal development project — NXTPAK Hackathon 2026, Egypt.  
ISO standard metadata stored under fair-use research principles; no copyrighted standard text is reproduced.

---

*Last updated: 2026-10-31 | Milestone 1*
