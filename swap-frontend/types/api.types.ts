export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    unread_count?: number
  }
}

export interface ValidationError {
  message: string
  errors: Record<string, string[]>
}

export interface ApiError {
  message: string
  status: number
  errors?: Record<string, string[]>
}
