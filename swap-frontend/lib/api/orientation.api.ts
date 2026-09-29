import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type {
  MyOrientation,
  OrientationAttendanceStatus,
  OrientationCandidate,
  OrientationSession,
  OrientationSessionInput,
} from '@/types/orientation.types'

export const orientationApi = {
  // ─── Admin ────────────────────────────────────────────────────────────────
  getSessions: () =>
    apiClient.get<{ data: OrientationSession[] }>('/admin/orientation/sessions').then((r) => r.data.data),

  // Approved applicants not yet placed, with where they stand.
  getCandidates: () =>
    apiClient.get<{ data: OrientationCandidate[] }>('/admin/orientation/candidates').then((r) => r.data.data),

  createSession: (data: OrientationSessionInput) =>
    apiClient.post<ApiResponse<OrientationSession>>('/admin/orientation/sessions', data).then((r) => r.data),

  updateSession: (id: number, data: OrientationSessionInput) =>
    apiClient.put<ApiResponse<OrientationSession>>(`/admin/orientation/sessions/${id}`, data).then((r) => r.data),

  deleteSession: (id: number) =>
    apiClient.delete<{ message: string }>(`/admin/orientation/sessions/${id}`).then((r) => r.data),

  // No user_ids → everyone eligible who is not yet invited to this session.
  invite: (id: number, userIds?: number[]) =>
    apiClient
      .post<ApiResponse<OrientationSession> & { meta: { invited: number; already: number } }>(
        `/admin/orientation/sessions/${id}/invite`,
        userIds ? { user_ids: userIds } : {},
      )
      .then((r) => r.data),

  markAttendance: (id: number, userId: number, status: OrientationAttendanceStatus) =>
    apiClient
      .put<ApiResponse<OrientationSession>>(`/admin/orientation/sessions/${id}/attendance`, { user_id: userId, status })
      .then((r) => r.data),

  // ─── Applicant ────────────────────────────────────────────────────────────
  getMine: () =>
    apiClient.get<{ data: MyOrientation[] }>('/applicant/orientation').then((r) => r.data.data),
}
