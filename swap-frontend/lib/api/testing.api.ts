import apiClient from './axios'
import type { EarlierTest, StorageCheck, TestingAction, TestingCandidate, TestingStatus } from '@/types/testing.types'

type WithStatus = { data: TestingStatus; message: string }

// Admin → System Testing, on and off only by the server's SWAP_TEST_TOOLS (live and local);
// while it's off every call answers 404.
export const testingApi = {
  status: () => apiClient.get<{ data: TestingStatus }>('/admin/testing').then((r) => r.data.data),

  // Sign-in codes for everyone, on/off (the admin's password confirms it).
  setLoginCode: (enabled: boolean, password: string) =>
    apiClient.put<WithStatus>('/admin/testing/login-code', { enabled, password }).then((r) => r.data),

  // Existing recipients/applicants to pick (name, email or student ID).
  candidates: (search: string) =>
    apiClient.get<{ data: TestingCandidate[] }>('/admin/testing/candidates', { params: { search } }).then((r) => r.data.data),

  addExisting: (userId: number) =>
    apiClient.post<WithStatus>(`/admin/testing/accounts/${userId}`).then((r) => r.data),

  // Takes the account out of testing as it is now (Restore first to undo the test).
  removeExisting: (userId: number) =>
    apiClient.delete<WithStatus>(`/admin/testing/accounts/${userId}`).then((r) => r.data),

  // Back to how it was when picked (whatever changed it, role included); it stays in testing.
  restoreExisting: (userId: number) =>
    apiClient.post<WithStatus>(`/admin/testing/accounts/${userId}/restore`).then((r) => r.data),

  // One account's emails off/on (bell notifications and account emails are unaffected).
  setAccountEmail: (userId: number, muted: boolean) =>
    apiClient.put<WithStatus>(`/admin/testing/accounts/${userId}/email`, { muted }).then((r) => r.data),

  // Applicant ↔ recipient, the role only (Restore puts it back). Needs the switch on.
  setAccountRole: (userId: number, role: 'applicant' | 'recipient') =>
    apiClient.put<WithStatus>(`/admin/testing/accounts/${userId}/role`, { role }).then((r) => r.data),

  // An applicant's application at any step (no emails; approval makes them a recipient).
  setApplicationStatus: (applicationId: number, status: string) =>
    apiClient.put<WithStatus>(`/admin/testing/applications/${applicationId}/status`, { status }).then((r) => r.data),

  // Start over: every application of the account, with documents, interviews and files, is removed.
  resetApplications: (userId: number) =>
    apiClient.post<WithStatus>(`/admin/testing/accounts/${userId}/reset-applications`).then((r) => r.data),

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

  // File storage check: where uploads go, a live write/read, image links, lost files.
  storageCheck: () => apiClient.get<{ data: StorageCheck }>('/admin/storage-check').then((r) => r.data.data),
}
