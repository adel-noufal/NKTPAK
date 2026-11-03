import axios from 'axios'
import { formatApiErrorDetail } from './error-format'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

export class ApiClientError extends Error {
  readonly response: { status: number; data: unknown }

  constructor(status: number, data: unknown) {
    const detail = data && typeof data === 'object' ? (data as Record<string, unknown>).detail : undefined
    const formatted = formatApiErrorDetail(detail ?? data)
    super(`API Error ${status}: ${formatted.summary}`)
    this.name = 'ApiClientError'
    this.response = { status, data }
  }
}

// Request interceptor
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const data = error.response.data
      const responseData = data instanceof Blob
        ? data.text().then((raw) => { try { return JSON.parse(raw) } catch { return { detail: raw || error.response.statusText } } })
        : Promise.resolve(data)
      return responseData.then((resolved) => Promise.reject(new ApiClientError(error.response.status, resolved)))
    } else if (error.request) {
      return Promise.reject(new Error(`Network error: Could not reach backend at ${API_BASE_URL}`))
    }
    return Promise.reject(error)
  }
)

export default apiClient
