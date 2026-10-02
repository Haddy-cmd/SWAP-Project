import apiClient from './axios'
import type { TestingAction, TestingCandidate, TestingStatus } from '@/types/testing.types'

type WithStatus = { data: TestingStatus; message: string }

// Admin → System Testing. Picking accounts and the shortcuts need the switch on (409 otherwise).
export const testingApi = {
  status: () => apiClient.get<{ data: TestingStatus }>('/admin/testing').then((r) => r.data.data),

  setEnabled: (enabled: boolean) =>
    apiClient.put<WithStatus>('/admin/testing/switch', { enabled }).then((r) => r.data),

  // Existing recipients/applicants to pick (name, email or student ID).
  candidates: (search: string) =>
    apiClient.get<{ data: TestingCandidate[] }>('/admin/testing/candidates', { params: { search } }).then((r) => r.data.data),

  addExisting: (userId: number) =>
    apiClient.post<WithStatus>(`/admin/testing/accounts/${userId}`).then((r) => r.data),

  // undo: put back what the shortcuts changed on that account first (otherwise the changes stay).
  removeExisting: (userId: number, undo: boolean) =>
    apiClient.delete<WithStatus & { kept: string[] }>(`/admin/testing/accounts/${userId}`, { data: { undo } }).then((r) => r.data),

  // Every picked account leaves testing, its changes undone.
  releaseAll: () => apiClient.delete<WithStatus>('/admin/testing').then((r) => r.data),

  // Shortcut on a picked recipient's current term (returns the refreshed status).
  act: (recipientId: number, action: TestingAction, data: Record<string, unknown> = {}) =>
    apiClient
      .post<WithStatus>(`/admin/testing/recipients/${recipientId}/${action}`, data)
      .then((r) => r.data),
}
