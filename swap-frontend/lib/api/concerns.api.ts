import apiClient from './axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { Concern, ConcernStatus } from '@/types/concern.types'

export const concernsApi = {
  // ─── Help page (any signed-in user) ─────────────────────────────────────
  getMine: () =>
    apiClient.get<{ data: Concern[] }>('/concerns').then((r) => r.data.data),

  submit: (data: { subject: string; message: string }) =>
    apiClient.post<ApiResponse<Concern>>('/concerns', data).then((r) => r.data),

  // ─── Admin inbox ────────────────────────────────────────────────────────
  // meta.counts carries the open / in_progress / resolved totals for the tabs.
  getInbox: (params?: { status?: ConcernStatus; page?: number }) =>
    apiClient.get<PaginatedResponse<Concern>>('/admin/concerns', { params }).then((r) => r.data),

  update: (id: number, data: { status: ConcernStatus; response?: string | null }) =>
    apiClient.put<ApiResponse<Concern>>(`/admin/concerns/${id}`, data).then((r) => r.data),
}
