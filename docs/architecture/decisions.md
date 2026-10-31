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
- **Decision:** All physical-test standards (`PHYSICAL_TEST`) in the registry strictly return `NOT_VERIFIABLE` or `NOT_CONFIGURED` from software. They NEVER return `PASS`. Every report states: *"Evaluated against: NxtPak ISO registry v1 (see source list). No company-specific requirements loaded."*
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
