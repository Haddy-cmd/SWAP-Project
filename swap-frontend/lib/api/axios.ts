import axios, { AxiosError } from 'axios'
import Cookies from 'js-cookie'
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

// Attach Bearer token on every request. The store is backed by per-tab
// sessionStorage, so when a page opens in a fresh tab (e.g. a QR deep link from
// the phone camera) we fall back to the cross-tab `swap_token` cookie.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token ?? Cookies.get('swap_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export type ApiRequestError = Error & {
  status?: number
  errors: Record<string, string[]>
  // Kept so existing `err.response?.data?.…` readers keep working.
  response?: AxiosError<ValidationError>['response']
}

function apiError(message: string, error: AxiosError<ValidationError>, errors?: Record<string, string[]>): ApiRequestError {
  return Object.assign(new Error(message), {
    status: error.response?.status,
    errors: errors ?? {},
    response: error.response,
  })
}

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
      return Promise.reject(apiError(data?.message || 'Validation failed', error, data?.errors))
    }

    if (error.response?.status === 500) {
      return Promise.reject(new Error('Server error. Please try again later.'))
    }

    // 403 / 404 / 409 / 429 …: surface the backend's own message verbatim, so every
    // page shows the same text the API enforces (e.g. a clock-in conflict) instead
    // of axios's "Request failed with status code 409". Blob downloads carry no
    // parsed message and pass through untouched for the caller to read.
    const data = error.response?.data
    if (data && typeof data === 'object' && typeof data.message === 'string') {
      return Promise.reject(apiError(data.message, error, data.errors))
    }

    return Promise.reject(error)
  }
)

export default apiClient
