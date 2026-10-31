import apiClient from './client'
import axios from 'axios'
import type { ProjectCreate, ExampleProject, ProjectDetail, PipelineResult } from '../types'

export interface CreateProjectResponse {
  project_id: string
  name: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  pipeline_result: PipelineResult
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
  created_at: string
  updated_at: string
  has_results: boolean
}>> {
  const response = await apiClient.get('/projects')
  return response.data
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const response = await apiClient.get<ProjectDetail>(`/projects/${id}`)
  return response.data
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`)
}

export async function listExamples(): Promise<ExampleProject[]> {
  const response = await apiClient.get<ExampleProject[]>('/examples')
  return response.data
}

export async function loadExample(exampleId: string): Promise<{ project_id: string; pipeline_result: PipelineResult }> {
  const response = await apiClient.post(`/examples/${exampleId}/load`)
  return response.data
}

export async function exportReport(
  projectId: string,
  alternativeId: string,
  format: 'pdf' | 'html' | 'json'
): Promise<Blob> {
  const response = await apiClient.post(
    `/projects/${projectId}/export`,
    {
      project_id: projectId,
      alternative_id: alternativeId,
      format,
    },
    { responseType: 'blob' }
  )
  return response.data
}

export async function getSystemHealth(): Promise<{
  status: string
  app_name: string
  version: string
  geometry_engine: string
  standards_version: string
}> {
  // Direct call to root /health
  const response = await axios.get('/health')
  return response.data
}
