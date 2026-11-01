// ============================================================
// NxtPak AI — TypeScript Types (Production Grade)
// Zero fake data, strict validation, full provenance tracking.
// ============================================================

export enum FragilityClass {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export type ProductType = 'blender' | 'stand_fan' | 'ceiling_fan' | 'washing_machine' | 'refrigerator' | 'air_conditioner' | 'tv' | 'kettle' | 'microwave' | 'water_heater' | 'other'
export const PRODUCT_TYPES: ProductType[] = ['blender', 'stand_fan', 'ceiling_fan', 'washing_machine', 'refrigerator', 'air_conditioner', 'tv', 'kettle', 'microwave', 'water_heater', 'other']

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

export enum SourceType {
  EL_ARABY_DATASHEET = 'EL_ARABY_DATASHEET',
  EL_ARABY_WEBSITE = 'EL_ARABY_WEBSITE',
  PUBLIC_RETAIL = 'PUBLIC_RETAIL',
  USER_ENTERED = 'USER_ENTERED',
  CAD_EXTRACTED = 'CAD_EXTRACTED',
  AI_ESTIMATED = 'AI_ESTIMATED',
  FROM_DESCRIPTION = 'FROM_DESCRIPTION',
  DERIVED = 'DERIVED',
  OFFICIAL_COMPANY = 'OFFICIAL_COMPANY',
}

export enum AlternativeRank {
  RECOMMENDED = 'RECOMMENDED',
  ALTERNATIVE = 'ALTERNATIVE',
  BASELINE = 'BASELINE',
}

export interface Provenance {
  source_name: string
  source_url?: string
  retrieval_date?: string
  source_type: SourceType
  confidence?: number
  is_edited?: boolean
  evidence_snippet?: string
}

export interface DimensionsInput {
  length: number
  width: number
  height: number
  unit: 'mm' | 'cm' | 'm' | 'inch'
}

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

export interface ProductInput {
  name: string
  brand: string
  model: string
  sku?: string | null
  category?: string | null
  product_type: ProductType
  product_type_provenance?: Provenance
  shipping_mode?: 'courier_parcel' | 'ltl_pallet' | 'full_truck' | 'container' | 'ecommerce_marketplace' | null
  weight_kg: number
  fragility_class: FragilityClass
  packed_dimensions: DimensionsInput
  components?: ComponentInput[]
  image_url?: string | null
  images?: string[]
  provenance?: Provenance
  notes?: string
}

export interface BaselinePackaging {
  carton_outer_length_mm: number
  carton_outer_width_mm: number
  carton_outer_height_mm: number
  board_type: string
  board_thickness_mm: number
  carton_cost_per_unit: number
  currency: string
  units_per_pallet: number
  pallet_type: string
  notes?: string
  provenance?: Provenance
}

export interface PlannedPackaging {
  carton_outer_length_mm: number
  carton_outer_width_mm: number
  carton_outer_height_mm: number
  board_thickness_mm: number
  notes?: string
  provenance?: Provenance
}

export interface OptimizationConfig {
  min_clearance_mm?: number
  standard_clearance_mm?: number
  generous_clearance_mm?: number
  board_thickness_mm?: number
  insert_thickness_mm?: number
}

export interface ProjectCreate {
  name: string
  description?: string
  product: ProductInput
  baseline: BaselinePackaging
  planned?: PlannedPackaging
  components?: ComponentInput[]
  optimization_config?: OptimizationConfig
  language?: 'en' | 'ar'
}

export interface MaterialUsage {
  carton_board_area_cm2: number
  carton_board_volume_cm3: number
  insert_volume_cm3: number
  total_material_volume_cm3: number
  corrugated_board_weight_kg: number
  co2_footprint_kg: number
  label: string
  formula_notes: string
}

export interface CostBreakdown {
  carton_cost: number
  insert_cost: number
  total_cost: number
  currency: string
  cost_status: string
}

export interface SavingsMetrics {
  volume_utilization: number
  volume_utilization_pct: number
  volume_utilization_formula?: string
  material_saved_pct: number
  material_saved_cm3: number
  material_savings_formula?: string
  cost_saved: number
  cost_saved_pct: number
  co2_saved_kg: number
  currency: string
  baseline_available: boolean
  savings_status: string
  inputs_used?: string[]
}

export interface McKeeCalculation {
  ect_kn_m: number
  board_thickness_mm: number
  box_perimeter_mm: number
  bct_newtons: number
  bct_kgf: number
  safety_factor: number
  max_safe_stack_load_kg: number
  estimated_max_stack_layers: number
  formula_display: string
}

export interface PalletizationResult {
  pallet_type: string
  pallet_length_mm: number
  pallet_width_mm: number
  max_pallet_height_mm: number
  cartons_per_layer: number
  layers_count: number
  total_cartons_per_pallet: number
  pallet_area_utilization_pct: number
  total_pallet_weight_kg: number
  stacking_pattern: string
}

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
  clearance_label?: string
  insert_thickness_mm: number
  insert_description: string
  material_usage: MaterialUsage
  savings: SavingsMetrics
  cost: CostBreakdown
  mckee_compression: McKeeCalculation
  palletization: PalletizationResult
  ranking_score: number
  ranking_criteria: Record<string, any>
  assumptions: string[]
  standards_summary?: Record<string, any>
}

export interface OptimizationResult {
  project_id: string
  product_name: string
  product_volume_mm3: number
  baseline_outer_volume_liters: number
  alternatives: PackagingAlternative[]
  recommended: PackagingAlternative
  baseline_included: boolean
  calculation_notes: string[]
  assumptions: string[]
  result_warning: string
}

export interface StandardsCheckResult {
  entry_id: string
  standard_identifier: string
  title: string
  check_type: CheckType
  status: CheckStatus
  details: string
  clause?: string
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
  evaluation_statement: string
  results: StandardsCheckResult[]
  programmatic_pass_count: number
  programmatic_fail_count: number
  not_configured_count: number
  not_verifiable_count: number
  needs_review_count: number
  disclaimer: string
}

export interface ProjectDetail {
  project_id: string
  short_id: string
  name: string
  brand: string
  model_number: string
  sku?: string | null
  description?: string
  status: string
  language: string
  product_data: ProductInput
  components_data?: ComponentInput[]
  baseline_data: BaselinePackaging
  planned_data?: PlannedPackaging | null
  optimization_config?: OptimizationConfig
  optimization_result?: OptimizationResult | null
  standards_result?: StandardsEvaluationResult | null
  chat_history?: AssistantMessage[]
  selected_alternative_id?: string
  created_at: string
  updated_at: string
}

export interface SourceEvidence {
  source_name: string
  source_url: string
  snippet: string
  fetched_at: string
  confidence: number
  is_official?: boolean
}

export interface ProductSpecField {
  value: any
  unit?: string | null
  status: 'verified' | 'found_single_source' | 'user' | 'calculated' | 'ai_estimated' | 'missing'
  sources: SourceEvidence[]
  conflict_values?: any[] | null
}

export interface ComponentSpec {
  name: string
  part_number?: string | null
  length_mm: number
  width_mm: number
  height_mm: number
  weight_kg: number
  quantity: number
  material?: string | null
  fragile?: boolean
  notes?: string | null
}

export interface CandidateSpecsResponse {
  candidate_id: string
  name: string
  brand: string
  model: string
  sku?: string | null
  category?: string | null
  product_dimensions: ProductSpecField
  carton_dimensions: ProductSpecField
  net_weight: ProductSpecField
  gross_weight: ProductSpecField
  components: ComponentSpec[]
  color?: string | null
  power_voltage?: string | null
  images: string[]
  datasheet_url?: string | null
  sources_checked: { source: string; status: string; url?: string }[]
  summary_bar: {
    filled_count: number
    total_count: number
    sources_summary: string
    needs_confirmation_count: number
    not_found_count: number
    text: string
  }
  packed_dimensions_available: boolean
  not_found_message?: string | null
  similar_products_for_estimate?: { model: string; dims: string; weight: string; similarity: number }[]
}

export interface ProductCandidate {
  candidate_id: string
  name: string
  brand: string
  model: string
  sku?: string | null
  category?: string | null
  net_weight_kg?: number | null
  gross_weight_kg?: number | null
  dimensions_mm?: { length: number; width: number; height: number } | null
  carton_dimensions_mm?: { length: number; width: number; height: number } | null
  image_url?: string | null
  images?: string[]
  datasheet_url?: string | null
  source_url: string
  source_type: SourceType
  confidence_score: number
  specs_table?: Record<string, string>
  components?: ComponentSpec[]
  sources_checked?: { source: string; status: string; url?: string }[]
  packed_dimensions_available?: boolean
  not_found_message?: string | null
  spec_fields?: Record<string, ProductSpecField>
  notes?: string | null
  provenance: Provenance
}

export interface ProductSearchRequest {
  query?: string | null
  brand?: string | null
  category?: string | null
  product_url?: string | null
  country_code?: string | null
  force_refresh?: boolean
}

export interface ProductSearchResponse {
  query: string
  normalized_query: string
  candidates: ProductCandidate[]
  exact_match: boolean
  did_you_mean?: string | null
  cached: boolean
  source_url_used?: string | null
  status_message: string
}

export interface UploadFileResult {
  success: boolean
  file_name: string
  file_type: string
  error?: string | null
  warning?: string | null
  components: ComponentInput[]
  bounding_box_mm?: Record<string, number> | null
  volume_cm3?: number | null
  surface_area_cm2?: number | null
  center_of_mass?: number[] | null
  is_watertight?: boolean | null
  units_assumed: string
  provenance?: Provenance | null
}

export interface AdminSettingsResponse {
  llm_provider: string
  llm_model: string
  llm_configured: boolean
  default_clearance_mm: number
  default_board_cost_per_m2: number
  currency: string
}

export interface AdminSettingsUpdate {
  llm_provider?: string
  llm_api_key?: string
  llm_model?: string
  default_clearance_mm?: number
  default_board_cost_per_m2?: number
  currency?: string
}

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system'
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
  provider_name?: string | null
  model_name?: string | null
  tools_called: string[]
  fields_cited: string[]
  disclaimer?: string | null
}

// ── AI Recommendation Types ────────────────────────────────────

export interface PackoutStep {
  step_number: number
  title: string
  description: string
  component_involved: string
}

export interface RejectedCandidate {
  name: string
  carton_length_mm: number
  carton_width_mm: number
  carton_height_mm: number
  failed_check: string
  explanation: string
}

export interface RecommendedCandidate {
  candidate_id: string
  name: string
  badge: string
  is_recommended: boolean

  // Dimensions & Board
  carton_length_mm: number
  carton_width_mm: number
  carton_height_mm: number
  board_grade: string
  board_thickness_mm: number
  ect_kn_m: number
  insert_type: string
  insert_material: string
  cushion_thickness_mm: number
  orientation: string
  units_per_carton: number

  // Pallet Logistics
  pallet_type: string
  cartons_per_layer: number
  layer_count: number
  units_per_pallet: number
  pallet_utilization_pct: number
  pallet_overhang_mm: number
  stacking_height_mm: number

  // Engineering Calculations
  bct_newtons: number
  bct_kgf: number
  stacking_load_kgf: number
  safety_factor: number
  box_perimeter_mm: number
  carton_board_area_m2: number

  // Savings
  material_savings_pct: number
  volume_savings_pct: number
  cost_per_unit?: number | null
  cost_savings_pct?: number | null
  cost_savings_per_1000_units?: number | null
  currency: string

  // Exploded Packout
  packout_steps: PackoutStep[]
}

export interface RecommendationRun {
  run_id: string
  project_id: string
  created_at: string
  model_name: string
  is_ai_reasoned: boolean

  recommended: RecommendedCandidate
  alternatives: RecommendedCandidate[]
  rejected_candidates: RejectedCandidate[]

  explanation: string
  confidence_level: 'High' | 'Medium' | 'Low'
  confidence_reason: string
  assumptions: string[]
  missing_data: string[]
  test_plan: string[]

  locked_fields: Record<string, any>
  refinement_history: Array<Record<string, any>>
  user_feedback?: {
    status: 'accepted' | 'rejected'
    reason?: string
    timestamp: string
  } | null
}
