import apiClient from './axios'
import type { User } from '@/types/auth.types'
import type { StipendRecord, EligibleStipend } from '@/types/analytics.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const adminApi = {
  getUsers: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<User>>('/admin/users', { params }).then((r) => r.data),

  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, data).then((r) => r.data.data),

  deleteUser: (id: number) =>
    apiClient.delete(`/admin/users/${id}`).then((r) => r.data),

  getStipendRecords: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<StipendRecord>>('/admin/stipend', { params }).then((r) => r.data),

  getEligibleStipends: () =>
    apiClient.get<{ data: EligibleStipend[] }>('/admin/stipend/eligible').then((r) => r.data.data),

  releaseStipend: (data: {
    user_id: number
    amount: number
    academic_year: string
    semester: string
    period_label?: string
    remarks?: string
  }) =>
    apiClient.post<ApiResponse<StipendRecord>>('/admin/stipend/release', data).then((r) => r.data.data),

  broadcastNotification: (data: { title: string; message: string; type?: string }) =>
    apiClient.post('/admin/notifications/broadcast', data).then((r) => r.data),

  generateReport: (params: { type: string; academic_year: string; semester: string }) =>
    apiClient.get('/admin/reports/generate', { params }).then((r) => r.data),
}
