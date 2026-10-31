# NxtPak AI — Project Plan

## Current Milestone: **Milestone 1** — Foundation & First End-to-End Workflow

**Status:** ✅ Complete & Verified  
**Started:** 2026-10-31  
**Completed:** 2026-10-31  
**Target:** Working demo with full ISO registry, 3D viewer, optimization, and exports

---

## Milestone 1 Definition of Done

| # | Requirement | Status |
|---|---|---|
| 1 | Documented project structure and AGENTS.md | ✅ Done |
| 2 | Frontend starts and builds cleanly (`pnpm dev` / `pnpm build`) | ✅ Done (Vite + TypeScript) |
| 3 | Backend starts and serves API (`uvicorn app.main:app`) | ✅ Done (FastAPI + SQLite) |
| 4 | Arabic/English switching works (RTL support) | ✅ Done (react-i18next + dir="rtl") |
| 5 | New Project form validates inputs (frontend + backend) | ✅ Done (Wizard + Pydantic v2) |
| 6 | 2–3 packaging alternatives generated deterministically | ✅ Done (Tight, Standard, Protective) |
| 7 | Alternatives ranked with visible criteria | ✅ Done (Volume util, material saved, drop buffer) |
| 8 | 3D viewer: Exterior/Interior toggle, wireframe, camera angles, rotation, zoom | ✅ Done (Three.js / React Three Fiber) |
| 9 | Savings computed from section 7 formulas | ✅ Done (Material %, vol %, cost savings) |
| 10 | PDF/HTML/JSON report generated and valid | ✅ Done (ReportLab + Jinja2 + JSON) |
| 11 | ISO registry loaded (16 entries), statuses correct | ✅ Done (16 ISO packaging standards) |
| 12 | Physical-test entries never show PASS | ✅ Done (NEVER_PASS strictly enforced) |
| 13 | Example projects load with correct labels | ✅ Done (Toshiba fan, Generic fan, Blender) |
| 14 | Automated tests run and results documented | ✅ Done (19 backend tests + Vitest passed) |
| 15 | Known limitations documented | ✅ Done (In README.md & project-plan.md) |

---

## Completed (Milestone 1)

- [x] Environment inspection and stack selection
- [x] Project directory structure
- [x] AGENTS.md with all constraints
- [x] README.md with install, commands, architecture
- [x] ISO registry JSON (`data/standards/iso_registry.json`) — 16 standards, metadata only, no copyrighted text
- [x] 3 example projects with correct data labels and provenance
- [x] Backend core config (`app/core/config.py`)
- [x] Backend database setup (`app/core/database.py`)
- [x] SQLAlchemy ORM models (`app/models/models.py`)
- [x] Pydantic schemas — all request/response types (`app/schemas/schemas.py`)
- [x] Standards registry loader and checker (`app/standards/registry.py`)
- [x] Product specs agent (`app/agents/product_specs_agent.py`)
- [x] Optimization engine — 3 deterministic alternatives (`app/optimization/engine.py`)
- [x] Geometry engine interface — trimesh + numpy fallback (`app/geometry/engine_interface.py`)
- [x] Validation module (`app/validation/validator.py`)
- [x] Orchestrator (`app/agents/orchestrator.py`)
- [x] Report generator — PDF, HTML, JSON (`app/reporting/report_generator.py`)
- [x] File exporter (`app/exports/exporter.py`)
- [x] Project service (`app/services/project_service.py`)
- [x] FastAPI endpoints (`app/api/v1/endpoints/projects.py`)
- [x] FastAPI main app (`app/main.py`)
- [x] Backend requirements.txt and .env.example
- [x] Backend tests (optimization, standards, validation, API)
- [x] Frontend scaffolded with Vite + React + TypeScript
- [x] Tailwind CSS, RTL support
- [x] React Three Fiber 3D viewer (Exterior + Interior)
- [x] All pages: Dashboard, NewProject, ProjectDetail, Standards, Settings, ProjectsList
- [x] ISO standards table with correct badges
- [x] Savings comparison table
- [x] Export panel
- [x] i18n: English + Arabic

---

## Known Limitations (Milestone 1)

1. **Multi-component arrangement:** Blender 4-part product is modeled as a single bounding box. Component-level packing heuristic deferred to Milestone 2.
2. **GLB export:** Geometry data is prepared in trimesh but direct file download deferred to Milestone 2. JSON and PDF exports are complete.
3. **ISO numeric parameters:** Drop heights, loads, vibration profiles are NOT hardcoded. Users must enter them from their licensed standards. Until entered, status is NOT_CONFIGURED.
4. **No El Araby company-specific checks:** Company specs are not publicly available. JSON import mechanism is ready for when they are provided.
5. **Physical testing:** All alternative designs are "PRELIMINARY GEOMETRIC PROTOTYPES." Physical testing is always required before production.
6. **LLM features:** Disabled. All core features work without an API key.
7. **3D/CAD file upload:** Deferred to Milestone 2.
8. **STEP/DWG export:** Not supported by free libraries; STEP planned for Milestone 2 if trimesh supports it.

---

## Milestone 2 (Planned — Do Not Build Yet)

- Upload STL, OBJ, GLB/GLTF files → extract bounding box
- Extended standards checks with user-configured parameters
- Multi-component arrangement for blender (4-part heuristic packing)
- GLB export (complete)
- CSV analytics export
- Richer insert/cushion layouts
- Material library (cardboard grades, foam types, EPS)

## Milestone 3 (Planned — Do Not Build Yet)

- LLM extraction from natural-language descriptions (Arabic + English) with deterministic fallback
- AI Assistant (packaging Q&A)
- Animated exploded view
- Approximate drop/compression screening simulation (labeled "screening only")
- STEP export (if trimesh supports it)

---

## Architecture Decisions Log

See `docs/architecture/decisions.md` for full rationale.

| Decision | Choice | Reason |
|---|---|---|
| Geometry engine | trimesh 5.x (numpy fallback) | CadQuery requires OpenCASCADE which is heavy/complex to install on Windows; trimesh is pure Python |
| Database | SQLite + aiosqlite | No external DB needed; async API; sufficient for Milestone 1 |
| Report generation | ReportLab (PDF) + Jinja2 (HTML) | Both free, both pre-installed |
| Agent framework | None — plain Python classes | No concrete need for an agent framework at this scale; adds complexity |
| LLM | Optional, disabled by default | Free tier constraint; deterministic fallback required |
| State management | Zustand + React Query | Lightweight, sufficient for project data |
| 3D rendering | React Three Fiber + Three.js | Best free option for interactive 3D in React |

---

## Dependencies

| Backend | Frontend |
|---|---|
| Python 3.11+ | Node.js 18+ |
| FastAPI | React 18 |
| Pydantic v2 | TypeScript |
| SQLAlchemy 2.x | Vite |
| aiosqlite | Tailwind CSS |
| trimesh | React Three Fiber |
| numpy | Zustand |
| ReportLab | React Query |
| Jinja2 | react-i18next |

---

*Last updated: 2026-10-31*
