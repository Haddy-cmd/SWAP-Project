import apiClient from './axios'
import type { User } from '@/types/auth.types'
import type { StipendRecord, EligibleStipend } from '@/types/analytics.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const adminApi = {
  getUsers: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<User>>('/admin/users', { params }).then((r) => r.data),

  // Email an account-creation link instead of creating the staff account directly.
  inviteUser: (data: { email: string; name?: string; role: string; office_id?: number | null }) =>
    apiClient.post<{ message: string }>('/admin/invitations', data).then((r) => r.data),

  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, data).then((r) => r.data.data),

  deleteUser: (id: number) =>
    apiClient.delete(`/admin/users/${id}`).then((r) => r.data),

  getStipendRecords: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<StipendRecord>>('/admin/stipend', { params }).then((r) => r.data),

  getEligibleStipends: () =>
    apiClient.get<{ data: EligibleStipend[] }>('/admin/stipend/eligible').then((r) => r.data.data),

  // Page-level step-up: one password entry unlocks the release/void calls for a
  // short window. The token lives in component memory only — never persisted.
  unlockStipend: (password: string) =>
    apiClient.post<{ data: { unlock_token: string; expires_in: number } }>('/admin/stipend/unlock', { password }).then((r) => r.data.data),

  // Releases a stipend (final; signed by supervisor, director and beneficiary). Authorized by the step-up
  // `password` OR the page-level `unlock_token` — exactly one of them.
  // `amount` is optional (defaults to the fixed semester stipend).
  releaseStipend: (data: {
    user_id: number
    amount?: number
    academic_year: string
    semester: string
    period_label?: string
    remarks?: string
    password?: string
    unlock_token?: string
  }) =>
    apiClient.post<ApiResponse<StipendRecord>>('/admin/stipend/release', data).then((r) => r.data.data),

  // Bulk release from the eligible checklist. Per-item outcomes come back as
  // released/skipped — one bad item never aborts the batch.
  releaseBulkStipend: (data: {
    unlock_token: string
    items: { user_id: number; amount?: number; academic_year: string; semester: string; period_label?: string; remarks?: string }[]
  }) =>
    apiClient.post<{
      data: { released: StipendRecord[]; skipped: { user_id: number; reason: string }[] }
      message: string
    }>('/admin/stipend/release-bulk', data).then((r) => r.data),

  voidStipend: (id: number, reason: string, auth: { password?: string; unlock_token?: string }) =>
    apiClient.post<ApiResponse<StipendRecord>>(`/admin/stipend/${id}/void`, { reason, ...auth }).then((r) => r.data.data),
}
