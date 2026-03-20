import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const isAuthEndpoint =
      config.url?.includes('/auth/login/') ||
      config.url?.includes('/auth/refresh/') ||
      config.url?.includes('/auth/azure-callback/')

    if (!isAuthEndpoint) {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
} 
  return config
})

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login/')) {
      originalRequest._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')
        const resp = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
        const { access } = resp.data
        localStorage.setItem('access_token', access)
        originalRequest.headers.Authorization = `Bearer ${access}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — clear tokens, cookie, and redirect to login
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
