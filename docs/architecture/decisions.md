# Architecture Decision Records (ADRs) — NxtPak AI

## ADR-001: Synchronous Thread-Safe SQLite Sessions
- **Status:** Accepted
- **Context:** In Python 3.13 on Windows sandboxed environments, `aiosqlite` event loop thread dispatch can encounter blocking issues with greenlet/asyncio queues during fast synchronous testing and local execution.
- **Decision:** Use standard thread-safe SQLAlchemy sessions with `check_same_thread=False` and standard session pools (`sqlite:///./nxtpak.db`).
- **Consequence:** Instantaneous, zero-deadlock database execution with 100% test reliability and zero native background thread overhead.

## ADR-002: Geometry Engine Interface with Fallback
- **Status:** Accepted
- **Context:** Heavy CAD engines (OpenCascade / CadQuery) require complex native C++ libraries that cannot be guaranteed across all student/hackathon OS environments.
- **Decision:** Standardize on a clean `GeometryEngine` interface backed by `trimesh 5.x` and a pure `numpy_only` fallback.
- **Consequence:** Parametric carton and cushion dimensions are computed deterministically without external CAD installations.

## ADR-003: ISO Packaging Standards Evaluation & Strict Disclaimer
- **Status:** Accepted
- **Context:** Factory packaging testing requires real physical laboratory equipment (drop towers, shake tables, environmental chambers).
- **Decision:** All physical-test standards (`PHYSICAL_TEST`) in the registry strictly return `NOT_VERIFIABLE` or `NOT_CONFIGURED` from software. They NEVER return `PASS`. Reports state the database-backed ISO and ISTA registry versions, entry counts, and verification date; no company-specific requirements are implied.
- **Consequence:** Prevents false compliance claims while providing clear test schedules and remaining steps for laboratory engineers.

## ADR-004: Parametric Deterministic Optimization Engine
- **Status:** Accepted
- **Context:** Packaging engineers require reproducible, explainable calculations for carton dimensions, board surface area, volume utilization, and material savings.
- **Decision:** Generate 3 deterministic alternatives (Tight Fit, Standard Balanced, and Protective Cushion) with visible clearances, explicit units (mm, kg, cm²), and open formulas.
- **Consequence:** Full transparency; eliminates hallucinations and guarantees predictable outputs.

## ADR-005: Draft Projects for Incomplete Measurements
- **Status:** Accepted
- **Context:** Real industrial products (such as the Tornado Stand Fan TSF-16W) ship disassembled, meaning the assembled product envelope is for reference only and packed component dimensions must be measured on site.
- **Decision:** When reference examples or incomplete products are loaded, the system creates a project in `draft` status with `optimization_status = "AWAITING_COMPONENT_DIMENSIONS"`. The optimization pipeline is deferred until the engineer enters measured component dimensions.
- **Consequence:** Eliminates fabricated/fake component dimensions; keeps the app honest and engineering-accurate.

## ADR-006: Optional Baseline Board Thickness
- **Status:** Accepted
- **Context:** Manufacturer datasheets publish external carton dimensions (e.g. 575 × 310 × 490 mm for TSF-16W), but corrugated board wall thickness (e.g. 3 mm, 4.5 mm) is not published in public retail or product sheets.
- **Decision:** Make `board_thickness_mm` optional in `BaselinePackaging`. When missing, internal cavity volume and board material volume vs baseline are reported as "Needs board thickness" rather than assuming an unverified value.
- **Consequence:** Preserves data provenance and transparently informs the engineer which physical measurement is still required.

## ADR-007: Canonical Millimetre Scene and Product Geometry
- **Status:** Accepted
- **Context:** Product models were centered using assumed origins while carton dimensions used a different axis convention, producing visible carton overhang and inconsistent dimension panels.
- **Decision:** Use millimetres with Y up, X length, Z width across scene geometry. Position product meshes by measured `THREE.Box3` bounds, derive displayed dimensions and clearances from those same bounds, and select the model only from the saved product type or CAD source.
- **Consequence:** All viewer modes can share measurable geometry and regression assertions; incomplete dimensions block rendering rather than becoming zero-valued geometry.

## ADR-008: Database-Backed ISO and ISTA Guidance
- **Status:** Accepted
- **Context:** Project evaluation and reports used a static ISO-only message and the ISTA catalog was absent from the user interface.
- **Decision:** Seed and serve both registries from the database, calculate project applicability from stored project inputs, and leave procedure selection empty when shipping mode is unknown. Suggested physical tests contain no invented test levels and require accredited laboratory execution.
- **Consequence:** Project tabs and reports reflect the same catalog metadata and avoid making unsupported shipping or compliance assumptions.

## ADR-009: Supplier-Sourced Cushion Curves Only
- **Status:** Accepted
- **Context:** Cushion response depends on material, static stress, thickness, and drop height; generic values would imply protection that has not been measured.
- **Decision:** Store editable cushioning materials and supplier curve points with source metadata. Calculate static stress from measured support loads and bearing areas, interpolate peak deceleration only within the supplied curve domain, and return no thickness when a required curve or input is absent.
- **Consequence:** Empty catalog entries are disabled and their unknown properties remain null. Any curve-derived thickness is an estimate requiring laboratory validation.

## ADR-010: Deterministic Recommendation Before Optional Reasoning
- **Status:** Accepted
- **Context:** Project creation previously navigated to the 3D tab and users had to trigger a separate recommendation request; an LLM request could delay calculated results.
- **Decision:** New project creation routes directly to the recommendation view. The recommendation endpoint returns deterministic calculations first; a separate optional reasoning request updates the explanation afterward.
- **Consequence:** Offline operation keeps a deterministic recommendation available, while AI reasoning remains optional and does not determine packaging geometry.

## ADR-011: Retire Unsourced Product Catalog Records
- **Status:** Accepted
- **Context:** The fetch pipeline returned hardcoded product dimensions, retailer labels, and cached cards as if live sources had verified them. Those records had no auditable source evidence.
- **Decision:** Remove the embedded product records and stop serving or saving those cached candidates. Search candidates may only be built from Gemini Google Search grounding page titles and URLs; dimensions and weights remain empty until a page fetch/parser supplies evidence. Show provider errors and return no candidates when results cannot be matched to the query.
- **Consequence:** Searches can temporarily return no products when Gemini grounding is unavailable or yields weak titles. A crawler-backed SQLite catalogue, alternative search providers, and richer field-level evidence remain unimplemented; they must ingest real pages with provenance before being enabled.
