import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.startsWith('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
