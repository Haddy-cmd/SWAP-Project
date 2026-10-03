import apiClient from './axios'
import type { EarlierTest, TestingAction, TestingCandidate, TestingStatus } from '@/types/testing.types'

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

  // Restores the account to how it was when picked (whatever changed it), then takes it out of testing.
  removeExisting: (userId: number) =>
    apiClient.delete<WithStatus>(`/admin/testing/accounts/${userId}`).then((r) => r.data),

  // Every picked account is restored and leaves testing.
  releaseAll: () => apiClient.delete<WithStatus>('/admin/testing').then((r) => r.data),

  // Accounts tested before restore points existed, and their one-time cleanup.
  earlierTests: () => apiClient.get<{ data: EarlierTest[] }>('/admin/testing/earlier').then((r) => r.data.data),
  cleanUpEarlierTest: (userId: number) =>
    apiClient.post<WithStatus>(`/admin/testing/earlier/${userId}`).then((r) => r.data),

  // Shortcut on a picked recipient's current term (returns the refreshed status).
  act: (recipientId: number, action: TestingAction, data: Record<string, unknown> = {}) =>
    apiClient
      .post<WithStatus>(`/admin/testing/recipients/${recipientId}/${action}`, data)
      .then((r) => r.data),
}
