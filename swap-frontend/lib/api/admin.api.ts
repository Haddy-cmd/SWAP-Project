import apiClient from './axios'
import type { User } from '@/types/auth.types'
import type { StipendRecord, EligibleStipend } from '@/types/analytics.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export interface ReportPreview {
  title: string
  headers: string[]
  rows: (string | number | null)[][]
  stats: { label: string; value: string }[]
}

export interface DutySlipVerification {
  valid: boolean
  reason?: string
  student_id?: string
  academic_year?: string
  semester?: string
  range?: string
  recipient_found?: boolean
  recipient_name?: string | null
  recorded_hours?: number | null
}

export const adminApi = {
  getUsers: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<User>>('/admin/users', { params }).then((r) => r.data),

  createUser: (data: { name: string; email: string; password: string; role: string; office_id?: number | null }) =>
    apiClient.post<ApiResponse<User>>('/admin/users', data).then((r) => r.data.data),

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

  previewReport: (params: { type: string; academic_year: string; semester: string }) =>
    apiClient.get<{ data: ReportPreview }>('/admin/reports/preview', { params }).then((r) => r.data.data),

  // Returns the report as a CSV Blob so the caller can trigger a browser download.
  generateReport: (params: { type: string; academic_year: string; semester: string }) =>
    apiClient.get<Blob>('/admin/reports/generate', { params, responseType: 'blob' }).then((r) => r.data),

  verifyDutySlip: (controlNo: string) =>
    apiClient
      .get<{ data: DutySlipVerification }>('/admin/duty-slip/verify', { params: { control_no: controlNo } })
      .then((r) => r.data.data),
}
