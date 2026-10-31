import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
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
      const message = error.response.data?.detail || error.response.statusText
      return Promise.reject(new Error(`API Error ${error.response.status}: ${message}`))
    } else if (error.request) {
      return Promise.reject(new Error('Network error: Could not reach backend at http://localhost:8000'))
    }
    return Promise.reject(error)
  }
)

export default apiClient
