# Architecture Overview — NxtPak AI

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│                                                      │
│  Dashboard → NewProject → ProjectDetail              │
│                           ├── 3D Workspace (R3F)     │
│                           ├── Optimization Table     │
│                           ├── Standards Page         │
│                           └── Export Panel           │
│                                                      │
│  State: Zustand + React Query                        │
│  i18n: react-i18next (en, ar RTL)                    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST  /api/v1
┌──────────────────────▼──────────────────────────────┐
│                  Backend (FastAPI)                   │
│                                                      │
│  POST /projects                                      │
│    └── Orchestrator                                  │
│         ├── ProductSpecsAgent (validate + normalize) │
│         ├── OptimizationEngine (3 alternatives)      │
│         ├── GeometryEngine (box + insert geometry)   │
│         ├── StandardsRegistry (run checks)           │
│         ├── Validator (consistency checks)           │
│         └── Returns structured OptimizationResult    │
│                                                      │
│  POST /projects/{id}/export                          │
│    └── Exporter → ReportGenerator → file             │
│                                                      │
│  GET /examples → load product_examples/*.json        │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
┌──────▼──────┐      ┌────────▼────────────────────────┐
│  SQLite DB  │      │  File System                     │
│  (projects, │      │  data/standards/iso_registry.json│
│   exports)  │      │  data/product_examples/*.json    │
└─────────────┘      │  exports/ (generated files)      │
                     └──────────────────────────────────┘
```

## Component Responsibilities

### Frontend

| Component | Location | Responsibility |
|---|---|---|
| App | `src/App.tsx` | Router, language direction |
| Layout | `src/components/layout/` | Sidebar, navigation |
| Dashboard | `src/pages/Dashboard.tsx` | Entry point, quick actions |
| NewProject | `src/pages/NewProject.tsx` | 3-step project creation form |
| ProjectDetail | `src/pages/ProjectDetail.tsx` | Project workspace: 3D, recommendations, alternatives, comparison, standards, export |
| PackagingViewer3D | `src/components/viewer/` | React Three Fiber 3D viewer |
| ComparisonTable | `src/components/optimization/` | Baseline vs alternatives table |
| ProjectStandardsCatalog | `src/components/standards/` | Database-backed ISO/ISTA catalog, project statuses, and suggested tests |
| BackendHealth | `src/components/layout/BackendHealth.tsx` | Polls backend health and communicates unavailable actions |
| projectStore | `src/store/projectStore.ts` | Current project, language, view mode |

### Backend

| Module | Location | Responsibility |
|---|---|---|
| Orchestrator | `app/agents/orchestrator.py` | Workflow coordination |
| ProductSpecsAgent | `app/agents/product_specs_agent.py` | Input validation + normalization |
| OptimizationEngine | `app/optimization/engine.py` | Deterministic 3-alternative generator |
| GeometryEngine | `app/geometry/engine_interface.py` | trimesh / numpy fallback |
| StandardsRegistry | `app/standards/registry.py` | ISO checks and ISTA procedure guidance |
| Standards Catalog API | `app/api/v1/endpoints/projects.py` | Database-backed ISO/ISTA catalog and project test plans |
| Validator | `app/validation/validator.py` | Dimensional consistency |
| ReportGenerator | `app/reporting/report_generator.py` | PDF, HTML, JSON |
| Exporter | `app/exports/exporter.py` | File management |
| ProjectService | `app/services/project_service.py` | SQLite CRUD |

## Data Flow: New Project Creation

```
User fills form (product dims + optional baseline)
  ↓
Frontend validates (immediate feedback)
  ↓
POST /api/v1/projects
  ↓
ProductSpecsAgent.validate_and_normalize()
  → dims to mm, volume_mm³, provenance recorded
  ↓
OptimizationEngine.generate_alternatives()
  → 3 alternatives: Tight / Standard / Protective
  → material areas, volumes, costs (if baseline), savings
  → ranking with explicit criteria
  ↓
GeometryEngine.generate_box_geometry()
  → vertices + faces for Three.js BufferGeometry
  ↓
StandardsRegistry.run_checks()
  → ISO 18602: volume_utilization (PROGRAMMATIC)
  → ISO 2206: face labeling (PROGRAMMATIC)
  → ISO 3676/3394: dimension fit (PROGRAMMATIC if configured)
  → All physical tests: NOT_VERIFIABLE
  → Human review standards: NEEDS_REVIEW
  ↓
Validator.validate_alternative_dims()
  ↓
ProjectService.create_project() → store in SQLite
  ↓
Response: OptimizationResult + StandardsEvaluationResult
  ↓
Frontend renders measured 3D views + comparisons + database-backed standards catalog
```

## Standards Registry Architecture

```
data/standards/iso_registry.json          (ISO metadata)
data/standards/ista_registry.json         (ISTA metadata and original scope summaries)
    ↓
Startup seeds standards_catalog from both metadata files
    ↓
Standards API serves catalog counts, verification dates, and source URLs
    ├── ISO checks: PROGRAMMATIC / PHYSICAL_TEST / HUMAN_REVIEW
    └── ISTA guidance: procedures selected only when shipment inputs support it
    ↓
Project tab and reports use the same database-backed evaluation statement
```

ISO checks continue through `StandardsRegistry.run_checks(product, alternative, config)`:
```
    ├── PROGRAMMATIC checks (computed)
    │   ├── ISO 18602: volume utilization ≥ 0.60 → PASS, < 0.40 → FAIL
    │   ├── ISO 18602: material savings vs baseline (if baseline given)
    │   ├── ISO 2206: face labeling (always PASS — naming convention)
    │   ├── ISO 3676: unit load fit (PASS/FAIL if config given, else NOT_CONFIGURED)
    │   └── ISO 3394: modular dims (PASS/FAIL if config given, else NOT_CONFIGURED)
    ├── PHYSICAL_TEST standards → NOT_VERIFIABLE (NEVER PASS)
    └── HUMAN_REVIEW standards → NEEDS_REVIEW
```

## Geometry Engine Interface

```python
# app/geometry/engine_interface.py
active_engine = detect_engine()  # "trimesh" | "numpy_only"

generate_box_geometry(L, W, H) → {vertices, faces, engine}
generate_glb_bytes(outer, inner, product) → bytes | None
get_active_engine() → str
```

The interface is the only entry point to geometry. Swapping the engine does not require changes elsewhere.

The interactive Three.js scene uses millimetres, Y up, X length, and Z width. Cartons, product models, parts, cushions, and measurement overlays use shared geometry helpers. Product placement and displayed dimensions come from `THREE.Box3` bounds; invalid or missing dimensions block rendering rather than being substituted with zero.

## Report Structure

Every generated report (PDF, HTML, JSON) contains:
1. Report metadata (project name, date, registry version)
2. **"PRELIMINARY GEOMETRIC PROTOTYPE"** label
3. Product specs with data labels and provenance
4. Baseline packaging (if provided) with data labels
5. All alternatives with formulas shown
6. Savings metrics or "NOT_CONFIGURED" if no baseline
7. ISO evaluation and ISO/ISTA catalog metadata with applicability reasons
8. Suggested validation tests (to be performed in an accredited lab), when shipping inputs are available
9. Database-derived ISO/ISTA registry counts, verification date, and company-requirements statement
10. "A software PASS is never proof of ISO certification or successful physical testing."
11. Known limitations

## Security Notes

- No secrets in code; `.env` is gitignored
- LLM API key only read from environment variable
- CORS configured from settings
- Input validation on both frontend and backend
- File exports validated before serving
