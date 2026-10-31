// ============================================================
// NxtPak AI — TypeScript Types
// Aligned with backend Pydantic schemas and UI needs
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

export enum AlternativeRank {
  RECOMMENDED = 'RECOMMENDED',
  ALTERNATIVE = 'ALTERNATIVE',
  BASELINE = 'BASELINE',
}

export interface DimensionsInput {
  length: number
  width: number
  height: number
  unit: 'mm' | 'cm' | 'm' | 'inch'
}

export interface Provenance {
  source_name: string
  source_url?: string
  retrieval_date?: string
  data_label?: string
  verified?: boolean
  verification_note?: string
}

export interface ProductInput {
  name: string
  category?: string
  packed_dimensions: DimensionsInput
  weight_kg: number
  fragility_class: FragilityClass
  fragility_note?: string
  provenance?: Provenance
}

export interface BaselinePackaging {
  carton_outer_length_mm: number
  carton_outer_width_mm: number
  carton_outer_height_mm: number
  board_thickness_mm: number
  board_type?: string
  carton_cost_per_unit?: number
  total_insert_cost_per_unit?: number
  currency?: string
  data_label?: string
}

export interface OptimizationConfig {
  min_clearance_mm: number
  standard_clearance_mm: number
  generous_clearance_mm: number
  board_thickness_mm?: number
  insert_thickness_mm?: number
  unit_load_length_mm?: number
  unit_load_width_mm?: number
  unit_load_height_mm?: number
  module_length_mm?: number
  module_width_mm?: number
}

export interface ProjectCreate {
  name: string
  description?: string
  product: ProductInput
  baseline?: BaselinePackaging
  optimization_config?: OptimizationConfig
  language?: 'en' | 'ar'
}

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
  material_saved_pct?: number
  material_saved_cm3?: number
  cost_saved?: number
  cost_saved_pct?: number
  currency?: string
  savings_label: string
  baseline_available: boolean
  savings_status: string
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
  iso_2206_face_labels: Record<string, string>
}

export interface PipelineResult {
  project_id: string
  normalized_product: any
  optimization_result: OptimizationResult
  standards_result: StandardsEvaluationResult
  geometry_data: GeometryData
  active_geometry_engine: string
}

export interface ProjectDetail {
  project_id: string
  name: string
  description?: string
  status: string
  language: string
  product_data: any
  baseline_data?: any
  optimization_config?: any
  optimization_result?: OptimizationResult
  standards_result?: StandardsEvaluationResult
  selected_alternative_id?: string
  created_at: string
  updated_at: string
}

export interface ExampleProject {
  example_id: string
  example_name: string
  description: string
  data_label: string
  data_warning: string
}
