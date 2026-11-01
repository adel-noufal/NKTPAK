import axios from 'axios'
import { API_BASE_URL } from './client'

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 4000 })
    return response.status === 200 && response.data?.status === 'healthy'
  } catch {
    return false
  }
}
