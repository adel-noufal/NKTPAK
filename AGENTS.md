# NxtPak AI — AGENTS.md

## Project Purpose

NxtPak AI is an intelligent packaging optimization tool for the NXTPAK Hackathon (Egypt), El Araby Group challenge.
It recommends right-sized packaging, shows interactive 3D previews (Exterior, Interior, product, exploded, and packed parts), calculates material and cost
savings versus a user-entered baseline, and presents packaging guidance alongside the database-backed ISO and ISTA catalogs —
without lowering the required protection level.

**Primary users:** Packaging and industrial engineers  
**Interface languages:** Arabic (RTL) and English  
**Event:** NXTPAK Hackathon, Egypt — El Araby Group packaging challenge

---

## Hard Constraints (Must Always Be Respected)

1. **Free tier only.** No paid APIs are required to run the app. Every core feature works with no API key.
2. **LLM use is optional.** Must be behind a provider interface, configured via environment variables, and have a
   deterministic fallback. Clearly disabled when no key is set.
3. **Runs locally on Windows, macOS, Linux.** Provide PowerShell and bash commands.
4. **No heavy native dependencies without a fallback.** Geometry engine is behind an interface; if CadQuery fails,
   fall back to numpy + trimesh. Document which engine is active.
5. **No AI 3D generation models.** Packaging geometry is parametric, deterministic code only.
6. **No paid API secrets committed.** Use environment variables only; never commit `.env`.
7. **No fake or invented data.** Never assign invented numeric values to any field. If unknown, leave it null and label it "Not available — enter it". Presets must use real El Araby data only.
8. **Data provenance on every field.** Every record carries source_name, source_url, retrieval_date, source_type, and is_edited flag. Clearances are labeled "ENGINEERING_ASSUMPTION" and never given a false ISO badge.
9. **One 3D coordinate convention.** Scene units are millimetres, Y is up, X is length, Z is width. Position objects and report dimensions from measured `THREE.Box3` bounds.
10. **Missing dimensions stay missing.** Never replace unknown or invalid product/carton dimensions with zero to build geometry or report clearance.

---

## ISO and ISTA Standards Registry Rules

1. **No standard text reproduction.** Store only: identifier, title, edition, scope summary (own words), relevance,
   check type, source URL, retrieval date, verification status.
2. **No hardcoded numeric test parameters.** Drop heights, loads, vibration profiles, conditioning ranges, and
   acceptance criteria are configurable inputs; if absent → status is `NOT_CONFIGURED`.
3. **Check types:**
   - `PROGRAMMATIC` — software can compute it
   - `PHYSICAL_TEST` — requires lab/factory testing
   - `HUMAN_REVIEW` — requires engineer judgment
4. **Result statuses:** `PASS` | `FAIL` | `NEEDS_REVIEW` | `NOT_CONFIGURED` | `NOT_VERIFIABLE`
5. **Physical-test standards NEVER return `PASS` from software.** Ever.
6. **No compliance certificates generated.** Software PASS ≠ ISO certification.
7. **No El Araby-specific checks.** Company specs are not public. Registry allows JSON import of `OFFICIAL_COMPANY`
   or `USER_ENTERED` requirements; until then, no company-specific checks exist.
8. **Every project/report statement is database-derived** and identifies the ISO and ISTA registries, entry counts, last verification date, and that no company-specific requirements are loaded.
9. **ISTA summaries are original guidance.** Never invent procedure test levels. When shipment mode is unknown, request it rather than recommending a guessed procedure.
10. **Verify procedure metadata from primary sources.** Keep source URL and verification date with each catalog record.

---

## Commands

### Backend

```powershell
# Windows (PowerShell)
cd d:\Adel\Projects\NxtPak\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# macOS / Linux
cd /path/to/NxtPak/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Run backend tests:**
```powershell
cd d:\Adel\Projects\NxtPak\backend
pytest tests/ -v
```

### Frontend

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

**Run frontend tests:**
```powershell
cd d:\Adel\Projects\NxtPak\frontend
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

### Quick start (both services)
Install backend dependencies once, then from `frontend/` run `pnpm install` and `pnpm dev:all`. The script starts the backend and frontend, polls `GET /api/health`, and reports startup errors. `VITE_API_URL` configures the frontend API base (default `http://127.0.0.1:8000`).

Backend: `http://127.0.0.1:8000` | API docs: `http://127.0.0.1:8000/docs` | Health: `http://127.0.0.1:8000/api/health`
Frontend: `http://127.0.0.1:5173`

---

## Coding Conventions

### General
- All code must be typed (TypeScript strict mode; Python type hints throughout).
- Every module has a clear, single responsibility.
- Never hardcode secrets, API keys, or ISO numeric test parameters.
- Units must be explicit everywhere (mm, kg, etc.); no hidden conversions.
- Estimates and sample data must be labeled; never presented as verified/official data.

### Python (Backend)
- Python 3.11+ compatible.
- Use Pydantic v2 for all schemas and validation.
- Use SQLAlchemy 2.x with async sessions (aiosqlite).
- All business logic in `services/` or `agents/` — never in API endpoint handlers.
- Geometry engine accessed only through `geometry/engine_interface.py`.
- Standards registry accessed only through `standards/registry.py`.
- Use `app.core.config` for all settings.
- Tests in `backend/tests/` using pytest. Run with `pytest tests/ -v`.

### TypeScript (Frontend)
- React 18 + TypeScript strict.
- Vite build tool.
- Tailwind CSS for styling; no inline styles except for dynamic 3D values.
- React Three Fiber / Three.js for 3D rendering.
- i18n via `react-i18next`; RTL support for Arabic.
- Every visible button either works or is marked "Planned".
- Zustand for global state management.
- React Query for server state.

### Documentation
- Keep docs in sync with code (README, project-plan, architecture, AGENTS.md).
- Record decisions in `docs/architecture/decisions.md`.
- When a limitation is found, document it immediately in the relevant doc.

---

## Module Inventory (Milestone 1)

| Module | Location | Responsibility |
|--------|----------|----------------|
| Orchestrator | `backend/app/agents/orchestrator.py` | Coordinate workflow, pass structured data |
| Product Specs | `backend/app/agents/product_specs_agent.py` | Validate and normalize product inputs |
| Standards | `backend/app/standards/` | Load registry, run checks, report status |
| Optimization Engine | `backend/app/optimization/` | Generate and rank packaging alternatives |
| Geometry Engine | `backend/app/geometry/` | Parametric box/insert geometry, GLB export |
| Validation | `backend/app/validation/` | Dimensional consistency, constraint checks |
| Reporting | `backend/app/reporting/` | PDF/HTML + JSON report generation |
| Exports | `backend/app/exports/` | File export (PDF, JSON, GLB prep) |
| Fetch Service | `backend/app/services/fetch_service.py` | El Araby product fetch and offline fixtures |
| Upload Service | `backend/app/services/upload_service.py` | 3D/CAD parsing (STL, OBJ, GLB, STEP, DXF) |
| Assistant Service | `backend/app/services/assistant_service.py` | Page-aware assistant with offline fallback |

---

## What NOT to Do

- Do not build everything in one giant step.
- Do not add microservices or agent frameworks without documented justification.
- Do not hardcode numeric ISO test parameters from memory.
- Do not implement fake AI features or generate fake compliance certificates.
- Do not claim simulations prove physical safety.
- Do not leave architectural decisions undocumented.
- Do not rewrite working modules unnecessarily.
- Do not install large dependencies without a stated purpose.
- Do not present sample/public-retail data as verified El Araby data.
- Do not mark unsupported export formats as complete.

---

## Data Labels Reference

| Label | Meaning |
|-------|---------|
| `SAMPLE DATA` | Fabricated for demonstration |
| `PUBLIC RETAIL DATA - UNVERIFIED` | From public retail pages; may be product or carton size |
| `USER ENTERED` | Provided by the user; not independently verified |
| `UNVERIFIED` | Source exists but data not confirmed |
| `ESTIMATE` | Calculated approximation; not measured |

---

## Current Milestone: Geometry, Data Recovery, Exports, and ISO/ISTA Guidance

- Canonical Three.js scene coordinates and Box3-based object placement, dimensions, and clearance measurements across Box, Inside, Product Alone, Exploded, and Packed Parts views.
- Product model selection uses saved product type or CAD geometry; unknown product types use a labelled generic shape.
- Partial product updates preserve existing fields. Legacy migration restores dimensions only from explicit saved project text; missing dimensions block geometry and clearance claims.
- Database-backed ISO and ISTA catalog, project applicability/recommendation reasons, source and verification metadata, and lab-only suggested procedures without invented test levels.
- PDF, standalone HTML, JSON, and DXF exports validate required dimensions and return actionable error responses.
- Backend tests include legacy migration and exports; frontend includes scene unit tests and Playwright geometry/evidence tests. Run the commands above rather than relying on a stale test count.

## Previous Release v2 Capabilities

- No fabricated sample projects are seeded. The maintained ISO/ISTA catalog metadata is loaded into the standards table; tests use isolated `test_nxtpak.db`.
- Free-text "Describe your project" AI prompt box on NewProject screen with automated field extraction, model auto-enrichment button, and required field validation.
- Live LLM model listing (`/api/v1/llm-models`) dynamically fetching text models from Google Gemini (with `x-goog-api-key` header, not URL query params), Anthropic, and OpenAI.
- Real connection test endpoint (`/api/v1/test-llm-connection`) with latency measurement and human-readable plain language error translation.
- 3D Workspace upgraded: removed floating "Product Envelope" text, added dynamic HTML dimension callouts, dimension overlays, and explicit "Approximate shape from entered dimensions — upload CAD for exact geometry" provenance banner.
- AssistantPanel refactored from floating fixed bubble to clean collapsible drawer accessible directly from the top navigation bar.
- Refined warm paper & warm charcoal aesthetic with calm stone tones across light and dark modes.
- McKee Box Compression Test (BCT) strength calculations and Euro Pallet (1200x800) layer packing optimization.
- Multi-candidate side-by-side picker cards and duplicate product detection (`(brand, model, sku)`).
- FEFCO 0201 DXF Dieline generation with separated CUT and CREASE layers.
- Complete English and Arabic (RTL) interface with Light and Dark themes.

---

*Last updated: 2026-10-31 | Keep this file in sync with the codebase.*
