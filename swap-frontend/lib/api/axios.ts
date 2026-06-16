import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/lib/store/authStore'
import type { ValidationError } from '@/types/api.types'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
})

// Attach Bearer token on every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Centralized response error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ValidationError>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Session expired. Please log in again.'))
    }

    if (error.response?.status === 422) {
      const data = error.response.data
      const validationError = new Error(data?.message || 'Validation failed') as Error & {
        errors: Record<string, string[]>
        status: number
      }
      validationError.errors = data?.errors ?? {}
      validationError.status = 422
      return Promise.reject(validationError)
    }

    if (error.response?.status === 500) {
      return Promise.reject(new Error('Server error. Please try again later.'))
    }

    return Promise.reject(error)
  }
)

export default apiClient
