// ============================================================
// NxtPak AI — TypeScript Types (v6)
// Aligned with backend Pydantic schemas — real data model with provenance.
// No fake/invented values. Missing values are null/undefined.
// ============================================================

export enum FragilityClass {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export enum CheckType {
  PROGRAMMATIC = 'PROGRAMMATIC',
  PHYSICAL_TEST = 'PHYSICAL_TEST',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
}

export enum CheckStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  NOT_VERIFIABLE = 'NOT_VERIFIABLE',
}

export enum DataLabel {
  SAMPLE_DATA = 'SAMPLE DATA',
  PUBLIC_RETAIL_UNVERIFIED = 'PUBLIC RETAIL DATA - UNVERIFIED',
  USER_ENTERED = 'USER ENTERED',
  ESTIMATE = 'ESTIMATE',
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
}

export enum SourceType {
  EL_ARABY_DATASHEET = 'EL_ARABY_DATASHEET',
  EL_ARABY_WEBSITE = 'EL_ARABY_WEBSITE',
  PUBLIC_RETAIL = 'PUBLIC_RETAIL',
  USER_ENTERED = 'USER_ENTERED',
  DERIVED = 'DERIVED',
  SAMPLE_DATA = 'SAMPLE_DATA',
  OFFICIAL_COMPANY = 'OFFICIAL_COMPANY',
}

export enum AlternativeRank {
  RECOMMENDED = 'RECOMMENDED',
  ALTERNATIVE = 'ALTERNATIVE',
  BASELINE = 'BASELINE',
}

// ── Provenance ────────────────────────────────────────────────
export interface Provenance {
  source_name: string
  source_url?: string
  retrieval_date?: string
  source_type?: SourceType
  is_edited?: boolean
  evidence_snippet?: string
  // legacy compat
  data_label?: string
  verified?: boolean
  verification_note?: string
}

// ── Dimensions ───────────────────────────────────────────────
export interface DimensionsInput {
  length: number
  width: number
  height: number
  unit: 'mm' | 'cm' | 'm' | 'inch'
}

// ── Component ────────────────────────────────────────────────
export interface ComponentInput {
  name: string
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  weight_kg?: number | null
  quantity?: number
  fragility?: FragilityClass | null
  notes?: string
  provenance?: Provenance
}

// ── Product ──────────────────────────────────────────────────
export interface ProductInput {
  name: string
  model?: string | null
  brand?: string | null
  category?: string | null
  packed_dimensions?: DimensionsInput | null  // optional — may not be known
  weight_kg?: number | null
  fragility_class?: FragilityClass | null      // required user choice, no hidden default
  fragility_note?: string
  components?: ComponentInput[]
  provenance?: Provenance
  notes?: string
}

// ── Baseline Packaging ───────────────────────────────────────
export interface BaselinePackaging {
  carton_outer_length_mm: number
  carton_outer_width_mm: number
  carton_outer_height_mm: number
  board_thickness_mm?: number | null  // optional — may not be known
  board_type?: string
  carton_cost_per_unit?: number | null
  total_insert_cost_per_unit?: number | null
  currency?: string
  data_label?: string
  notes?: string
  provenance?: Provenance
}

// ── Planned Packaging (user's own proposed design) ───────────
export interface PlannedPackaging {
  carton_outer_length_mm: number
  carton_outer_width_mm: number
  carton_outer_height_mm: number
  board_thickness_mm?: number | null
  notes?: string
  provenance?: Provenance
}

// ── Optimization Config ──────────────────────────────────────
export interface OptimizationConfig {
  min_clearance_mm?: number
  standard_clearance_mm?: number
  generous_clearance_mm?: number
  board_thickness_mm?: number
  insert_thickness_mm?: number
  unit_load_length_mm?: number | null
  unit_load_width_mm?: number | null
  unit_load_height_mm?: number | null
  module_length_mm?: number | null
  module_width_mm?: number | null
}

// ── Project Create ───────────────────────────────────────────
export interface ProjectCreate {
  name: string
  description?: string
  product: ProductInput
  components?: ComponentInput[]
  baseline?: BaselinePackaging
  planned?: PlannedPackaging
  optimization_config?: OptimizationConfig
  language?: 'en' | 'ar'
}

// ── Material / Cost / Savings ────────────────────────────────
export interface MaterialUsage {
  carton_board_area_cm2: number
  carton_board_volume_cm3: number
  insert_volume_cm3: number
  total_material_volume_cm3: number
  label: string
  formula_notes: string
}

export interface CostBreakdown {
  carton_cost?: number
  insert_cost?: number
  total_cost?: number
  currency?: string
  cost_label: string
  cost_status: string
}

export interface SavingsMetrics {
  volume_utilization: number
  volume_utilization_pct: number
  volume_utilization_formula?: string
  material_saved_pct?: number | null
  material_saved_cm3?: number | null
  material_savings_formula?: string
  cost_saved?: number | null
  cost_saved_pct?: number | null
  currency?: string
  savings_label: string
  baseline_available: boolean
  savings_status: string
  inputs_used?: string[] | null
}

// ── Packaging Alternative ────────────────────────────────────
export interface PackagingAlternative {
  alternative_id: string
  name: string
  description: string
  rank: AlternativeRank
  outer_length_mm: number
  outer_width_mm: number
  outer_height_mm: number
  board_thickness_mm: number
  inner_length_mm: number
  inner_width_mm: number
  inner_height_mm: number
  clearance_length_mm: number
  clearance_width_mm: number
  clearance_height_mm: number
  clearance_label?: string  // always "ENGINEERING_ASSUMPTION — user-editable, not ISO-specified"
  insert_thickness_mm: number
  insert_description: string
  material_usage: MaterialUsage
  savings: SavingsMetrics
  cost: CostBreakdown
  ranking_score: number
  ranking_criteria: Record<string, any>
  assumptions: string[]
  data_label: string
  standards_summary?: Record<string, any>
}

// ── Optimization Result ──────────────────────────────────────
export interface OptimizationResult {
  project_id: string
  product_name: string
  product_volume_mm3: number
  alternatives: PackagingAlternative[]
  recommended: PackagingAlternative
  baseline_included: boolean
  calculation_notes: string[]
  assumptions: string[]
  result_label: string
  result_warning: string
}

// ── Standards ────────────────────────────────────────────────
export interface StandardsCheckResult {
  entry_id: string
  standard_identifier: string
  title: string
  check_type: CheckType
  status: CheckStatus
  details: string
  parameters_used: Record<string, any>
  sub_check_results: Array<{ sub_check_id: string; status: string; detail: string }>
  what_is_still_required: string[]
  source_url?: string
}

export interface StandardsEvaluationResult {
  project_id: string
  alternative_id: string
  evaluated_at: string
  registry_version: string
  registry_source: string
  company_requirements_loaded: boolean
  company_requirements_note: string
  evaluation_statement: string
  results: StandardsCheckResult[]
  programmatic_pass_count: number
  programmatic_fail_count: number
  not_configured_count: number
  not_verifiable_count: number
  needs_review_count: number
  disclaimer: string
}

// ── Geometry ─────────────────────────────────────────────────
export interface GeometryData {
  engine: string
  units: string
  outer_carton: {
    vertices: number[][]
    faces: number[][]
    dimensions_mm: { length: number; width: number; height: number }
  }
  inner_cavity: {
    vertices: number[][]
    faces: number[][]
    dimensions_mm: { length: number; width: number; height: number }
  }
  product_mesh: {
    vertices: number[][]
    faces: number[][]
    dimensions_mm: { length: number; width: number; height: number }
  }
  inserts_mesh?: {
    vertices: number[][]
    faces: number[][]
    dimensions_mm: { length: number; width: number; height: number }
  }
  // Note: iso_2206_face_labels removed — ISO 2206 is about test-part identification, not viewer labeling
}

// ── Pipeline Result ──────────────────────────────────────────
export interface PipelineResult {
  project_id: string
  normalized_product: any
  optimization_result: OptimizationResult
  standards_result: StandardsEvaluationResult
  geometry_data: GeometryData
  active_geometry_engine: string
}

// ── Project Detail ───────────────────────────────────────────
export interface ProjectDetail {
  project_id: string
  name: string
  description?: string
  status: string
  language: string
  product_data: ProductInput | null
  components_data?: ComponentInput[]
  baseline_data?: BaselinePackaging | null
  planned_data?: PlannedPackaging | null
  optimization_config?: OptimizationConfig
  optimization_result?: OptimizationResult | null
  standards_result?: StandardsEvaluationResult | null
  chat_history?: AssistantMessage[]
  selected_alternative_id?: string
  created_at: string
  updated_at: string
}

// ── Example Projects ─────────────────────────────────────────
export interface ExampleProject {
  example_id: string
  example_name: string
  description: string
  model?: string
  brand?: string
  data_label?: string
  source_url?: string
  source_type?: SourceType
  available_fields?: string[]
  missing_fields?: string[]
}

// ── Fetch Product ─────────────────────────────────────────────
export interface FetchedFieldValue {
  field_name: string
  value: any
  unit?: string | null
  source_url: string
  evidence_snippet: string
  source_type: SourceType
  retrieval_date: string
  is_edited?: boolean
}

export interface FetchProductResult {
  success: boolean
  error?: string | null
  source_url?: string | null
  source_type?: SourceType | null
  retrieved_at?: string | null
  fields: FetchedFieldValue[]
  unresolved_fields: string[]
  warning?: string | null
}

// ── Upload File ───────────────────────────────────────────────
export interface UploadFileResult {
  success: boolean
  file_name: string
  file_type: string
  error?: string | null
  warning?: string | null
  components: ComponentInput[]
  bounding_box_mm?: Record<string, number | null> | null
  units_confirmed: boolean
  units_assumed?: string | null
}

// ── AI Assistant ──────────────────────────────────────────────
export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface AssistantRequest {
  project_id?: string | null
  message: string
  page_context?: Record<string, any> | null
  history?: AssistantMessage[]
}

export interface AssistantResponse {
  reply: string
  mode: 'ai' | 'offline'
  fields_cited: string[]
  disclaimer?: string | null
}
