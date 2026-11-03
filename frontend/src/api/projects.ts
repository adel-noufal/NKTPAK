import apiClient from './client'
import axios from 'axios'
import type {
  ProjectCreate,
  ProjectDetail,
  ProductSearchRequest,
  ProductSearchResponse,
  CandidateSpecsResponse,
  UploadFileResult,
  AssistantRequest,
  AssistantResponse,
  AdminSettingsResponse,
  AdminSettingsUpdate,
} from '../types'

// ── Create / List / Get / Delete projects ────────────────────

export interface CreateProjectResponse {
  project_id: string
  name: string
  brand?: string
  model_number?: string
  sku?: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  pipeline_result?: Record<string, any> | null
  optimization_skipped?: boolean
  optimization_skipped_reason?: string | null
  duplicate_warning?: boolean | string
  duplicate_message?: string
}

export async function createProject(data: ProjectCreate): Promise<CreateProjectResponse> {
  const response = await apiClient.post<CreateProjectResponse>('/projects', data)
  return response.data
}

export interface ListProjectsParams {
  search?: string
  brand?: string
  status?: string
}

export async function listProjects(params?: ListProjectsParams): Promise<Array<{
  project_id: string
  name: string
  brand?: string
  model_number?: string
  sku?: string
  description?: string
  status: string
  product_name?: string
  product_model?: string
  created_at: string
  updated_at: string
  has_results: boolean
  has_baseline: boolean
  has_components: boolean
}>> {
  const response = await apiClient.get('/projects', { params })
  return response.data
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const response = await apiClient.get<ProjectDetail>(`/projects/${id}`)
  return response.data
}

export async function updateProject(id: string, data: Record<string, any>): Promise<{ project_id: string; status: string }> {
  const response = await apiClient.patch(`/projects/${id}`, data)
  return response.data
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`)
}

// ── Re-run optimization ───────────────────────────────────────

export async function reoptimizeProject(id: string): Promise<any> {
  const response = await apiClient.post(`/projects/${id}/optimize`)
  return response.data
}

// ── Brands ────────────────────────────────────────────────────

export async function getBrands(): Promise<string[]> {
  const response = await apiClient.get<string[]>('/brands')
  return response.data
}

// ── Admin Settings ────────────────────────────────────────────

export async function getAdminSettings(): Promise<AdminSettingsResponse> {
  const response = await apiClient.get<AdminSettingsResponse>('/settings')
  return response.data
}

export async function updateAdminSettings(settings: AdminSettingsUpdate): Promise<AdminSettingsResponse> {
  const response = await apiClient.patch<AdminSettingsResponse>('/settings', settings)
  return response.data
}

export interface FoamMaterial {
  material_id: string
  name: string
  material_type: string
  density_kg_m3: number | null
  available_thicknesses_mm: number[]
  cost_per_m3: number | null
  cost_per_kg: number | null
  sustainability_note: string | null
  temperature_humidity_notes: string | null
  cushion_curves: Array<{
    thickness_mm: number
    drop_height_mm: number
    points: Array<{ static_stress_kpa: number; peak_deceleration_g: number }>
  }>
  source_name: string | null
  source_url: string | null
  retrieval_date: string | null
  is_edited: boolean
  enabled: boolean
}

export async function getFoamMaterials(): Promise<FoamMaterial[]> {
  const response = await apiClient.get<FoamMaterial[]>('/settings/foam-materials')
  return response.data
}

export async function updateFoamMaterials(materials: FoamMaterial[]): Promise<FoamMaterial[]> {
  const response = await apiClient.put<FoamMaterial[]>('/settings/foam-materials', materials)
  return response.data
}

// ── Real Dynamic AI Fetch ─────────────────────────────────────

export async function fetchProduct(req: ProductSearchRequest): Promise<ProductSearchResponse> {
  const response = await apiClient.post<ProductSearchResponse>('/fetch-product', req)
  return response.data
}

export async function getCandidateSpecs(candidateId: string, model?: string): Promise<CandidateSpecsResponse> {
  const params = model ? `?model=${encodeURIComponent(model)}` : ''
  const response = await apiClient.get<CandidateSpecsResponse>(`/fetch-product/${candidateId}/specs${params}`)
  return response.data
}

export async function estimateDimensions(query: string, category?: string): Promise<any> {
  const response = await apiClient.post('/estimate-dimensions', { query, category })
  return response.data
}

// ── Upload 3D/CAD file ────────────────────────────────────────

export async function uploadModel(file: File): Promise<UploadFileResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post<UploadFileResult>('/upload-model', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// ── AI Assistant ──────────────────────────────────────────────

export async function sendAssistantMessage(req: AssistantRequest): Promise<AssistantResponse> {
  const response = await apiClient.post<AssistantResponse>('/assistant', req)
  return response.data
}

// ── Export ────────────────────────────────────────────────────

export async function exportReport(
  projectId: string,
  alternativeId: string,
  format: 'pdf' | 'html' | 'json' | 'dxf'
): Promise<Blob> {
  const response = await apiClient.post(
    `/projects/${projectId}/export`,
    { project_id: projectId, alternative_id: alternativeId, format },
    { responseType: 'blob' }
  )
  return response.data
}

// ── System Health ─────────────────────────────────────────────

export async function getSystemHealth(): Promise<{
  status: string
  app_name: string
  version: string
  geometry_engine: string
  standards_version: string
  llm_status: string
  llm_provider: string
  llm_model: string
}> {
  const response = await axios.get(`${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/api/health`)
  return response.data
}

// ── LLM Model List ────────────────────────────────────────────

export async function fetchLLMModels(provider: string, key?: string): Promise<string[]> {
  const params = new URLSearchParams({ provider })
  if (key) params.set('key', key)
  const response = await apiClient.get<{ provider: string; models: string[] }>(
    `/llm-models?${params.toString()}`
  )
  return response.data.models
}

// ── Test LLM Connection ───────────────────────────────────────

export interface LLMTestResult {
  success: boolean
  latency_ms?: number | null
  model_used?: string
  provider?: string
  error?: string
  reply_preview?: string
}

export async function testLLMConnection(
  provider: string,
  apiKey: string,
  model: string
): Promise<LLMTestResult> {
  const response = await apiClient.post<LLMTestResult>('/test-llm-connection', {
    provider,
    api_key: apiKey,
    model,
  })
  return response.data
}

// ── Description Extraction ────────────────────────────────────

export interface ExtractedField {
  field: string
  value?: string | null
  provenance: string
  confidence?: number | null
  missing: boolean
}

export interface ProjectDraft {
  name?: string | null
  brand?: string | null
  model_number?: string | null
  product_type?: string | null
  sku?: string | null
  product_length_mm?: number | null
  product_width_mm?: number | null
  product_height_mm?: number | null
  net_weight_kg?: number | null
  fragility?: string | null
  carton_length_mm?: number | null
  carton_width_mm?: number | null
  carton_height_mm?: number | null
  board_type?: string | null
  units_per_carton?: number | null
  notes?: string | null
  fields: ExtractedField[]
  missing_required: string[]
  llm_offline: boolean
  extraction_notes: string
}

export async function extractFromDescription(text: string, language = 'en'): Promise<ProjectDraft> {
  const response = await apiClient.post<ProjectDraft>('/extract-from-description', { text, language })
  return response.data
}

// ── AI Recommendation Endpoints ───────────────────────────────

import type { RecommendationRun } from '../types'

export async function getProjectRecommendation(projectId: string): Promise<RecommendationRun> {
  const response = await apiClient.get<RecommendationRun>(`/projects/${projectId}/recommendation`)
  return response.data
}

export async function generateProjectRecommendation(projectId: string): Promise<RecommendationRun> {
  const response = await apiClient.post<RecommendationRun>(`/projects/${projectId}/recommendation`)
  return response.data
}

export async function reasonProjectRecommendation(projectId: string): Promise<RecommendationRun> {
  const response = await apiClient.post<RecommendationRun>(`/projects/${projectId}/recommendation/reasoning`)
  return response.data
}

export async function refineProjectRecommendation(
  projectId: string,
  prompt: string,
  lockedFields?: Record<string, any>
): Promise<RecommendationRun> {
  const response = await apiClient.post<RecommendationRun>(`/projects/${projectId}/recommendation/refine`, {
    prompt,
    locked_fields: lockedFields,
  })
  return response.data
}

export async function acceptRecommendationCandidate(
  projectId: string,
  candidateId: string
): Promise<{ status: string; active_design: string }> {
  const response = await apiClient.post<{ status: string; active_design: string }>(
    `/projects/${projectId}/recommendation/accept?candidate_id=${encodeURIComponent(candidateId)}`
  )
  return response.data
}

export async function submitRecommendationFeedback(
  projectId: string,
  status: 'accepted' | 'rejected',
  reason?: string
): Promise<{ status: string }> {
  const response = await apiClient.post<{ status: string }>(`/projects/${projectId}/recommendation/feedback`, {
    status,
    reason,
  })
  return response.data
}
