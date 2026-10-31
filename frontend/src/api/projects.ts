import apiClient from './client'
import axios from 'axios'
import type {
  ProjectCreate,
  ExampleProject,
  ProjectDetail,
  PipelineResult,
  FetchProductResult,
  UploadFileResult,
  AssistantRequest,
  AssistantResponse,
} from '../types'

// ── Create / List / Get / Delete projects ────────────────────

export interface CreateProjectResponse {
  project_id: string
  name: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  pipeline_result?: PipelineResult | null
  optimization_skipped?: boolean
  optimization_skipped_reason?: string | null
}

export async function createProject(data: ProjectCreate): Promise<CreateProjectResponse> {
  const response = await apiClient.post<CreateProjectResponse>('/projects', data)
  return response.data
}

export async function listProjects(): Promise<Array<{
  project_id: string
  name: string
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
  const response = await apiClient.get('/projects')
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

// ── Examples ──────────────────────────────────────────────────

export async function listExamples(): Promise<ExampleProject[]> {
  const response = await apiClient.get<ExampleProject[]>('/examples')
  return response.data
}

export interface LoadExampleResponse {
  project_id: string
  name: string
  description?: string
  status: string
  optimization_status: string
  next_step: string
  component_suggestions?: Array<{ name: string; notes?: string }>
}

export async function loadExample(exampleId: string): Promise<LoadExampleResponse> {
  const response = await apiClient.post<LoadExampleResponse>(`/examples/${exampleId}/load`)
  return response.data
}

// ── Fetch from El Araby ───────────────────────────────────────

export async function fetchProduct(req: {
  model_number?: string | null
  product_url?: string | null
}): Promise<FetchProductResult> {
  const response = await apiClient.post<FetchProductResult>('/fetch-product', req)
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
  format: 'pdf' | 'html' | 'json'
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
}> {
  const response = await axios.get('/health')
  return response.data
}
