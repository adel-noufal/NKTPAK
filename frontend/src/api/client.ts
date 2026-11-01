import axios from 'axios'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

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
      const message = data instanceof Blob
        ? data.text().then((raw) => {
            try { const parsed = JSON.parse(raw); return parsed.message || parsed.detail || error.response.statusText }
            catch { return error.response.statusText }
          })
        : Promise.resolve(data?.message || data?.detail || error.response.statusText)
      return message.then((resolved) => Promise.reject(new Error(`API Error ${error.response.status}: ${resolved}`)))
    } else if (error.request) {
      return Promise.reject(new Error(`Network error: Could not reach backend at ${API_BASE_URL}`))
    }
    return Promise.reject(error)
  }
)

export default apiClient
