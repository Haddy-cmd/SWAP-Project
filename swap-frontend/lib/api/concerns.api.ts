import apiClient from './axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { Concern, ConcernStatus } from '@/types/concern.types'

export const concernsApi = {
  // ─── Help page (any signed-in user) ─────────────────────────────────────
  getMine: () =>
    apiClient.get<{ data: Concern[] }>('/concerns').then((r) => r.data.data),

  submit: (data: { subject: string; message: string }) =>
    apiClient.post<ApiResponse<Concern>>('/concerns', data).then((r) => r.data),

  // Add a follow-up to an unresolved concern (no subject — the thread keeps it).
  reply: (id: number, body: string) =>
    apiClient.post<ApiResponse<Concern>>(`/concerns/${id}/messages`, { body }).then((r) => r.data),

  // ─── Admin inbox ────────────────────────────────────────────────────────
  // meta.counts carries the open / in_progress / resolved totals for the tabs.
  // `search` matches the subject, any message, or the sender's name, email, student or employee ID.
  getInbox: (params?: { status?: ConcernStatus; page?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Concern>>('/admin/concerns', {
      params: { ...params, search: params?.search?.trim() || undefined },
    }).then((r) => r.data),

  update: (id: number, data: { status: ConcernStatus; response?: string | null }) =>
    apiClient.put<ApiResponse<Concern>>(`/admin/concerns/${id}`, data).then((r) => r.data),
}
