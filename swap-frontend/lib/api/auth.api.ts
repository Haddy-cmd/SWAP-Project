import apiClient from './axios'
import type { AuthResponse, LoginChallenge, LoginCredentials, MyActivityEntry, ProfileSession, RegisterData, RegisterResponse, User } from '@/types/auth.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<RegisterResponse>('/auth/register', data).then((r) => r.data),

  // Step one; a LoginChallenge means a 6-digit code was emailed (unless this browser is trusted).
  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse | LoginChallenge>('/auth/login', credentials).then((r) => r.data),

  // Step two: the emailed code; trust_device remembers this browser for 30 days.
  verifyLoginCode: (data: { challenge: string; code: string; trust_device: boolean }) =>
    apiClient.post<AuthResponse>('/auth/login/verify', data).then((r) => r.data),

  resendLoginCode: (challenge: string) =>
    apiClient.post<{ message: string }>('/auth/login/resend', { challenge }).then((r) => r.data),

  // Sign-up step two: the right code creates the account and signs it in.
  confirmRegistration: (email: string, code: string) =>
    apiClient.post<AuthResponse>('/auth/register/verify', { email, code }).then((r) => r.data),

  resendRegistrationCode: (email: string) =>
    apiClient.post<{ message: string }>('/auth/register/resend', { email }).then((r) => r.data),

  // Accounts made before sign-up waited for the code: verify by code (then sign in).
  verifyEmailCode: (email: string, code: string) =>
    apiClient.post<{ verified: boolean; message: string }>('/auth/verify-email', { email, code }).then((r) => r.data),

  resendVerification: (email: string) =>
    apiClient.post('/auth/resend-verification', { email }).then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (data: { email: string; code: string; password: string; password_confirmation: string }) =>
    apiClient.post('/auth/reset-password', data).then((r) => r.data),

  // Staff invitation (public): describe the invite, then accept it to create the account.
  getInvitation: (token: string) =>
    apiClient
      .get<ApiResponse<{ email: string; name: string | null; role: string; office: string | null; expires_at: string }>>(`/invitations/${token}`)
      .then((r) => r.data.data),

  acceptInvitation: (token: string, data: { name: string; employee_id: string; password: string; password_confirmation: string }) =>
    apiClient.post<AuthResponse>(`/invitations/${token}/accept`, data).then((r) => r.data),

  getProfile: () =>
    apiClient.get<ApiResponse<User>>('/profile').then((r) => r.data.data),

  updateProfile: (data: Partial<User> & Record<string, unknown>) =>
    apiClient.put<ApiResponse<User>>('/profile', data).then((r) => r.data.data),

  uploadPhoto: (file: File) => {
    const fd = new FormData()
    fd.append('photo', file)
    return apiClient
      .post<ApiResponse<User>>('/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.data)
  },

  removePhoto: () =>
    apiClient.delete<ApiResponse<User>>('/profile/photo').then((r) => r.data.data),

  // Digital-signature specimen (drawn on screen or uploaded). Auto-applied to
  // this user's stipend signatures: director certification for admins, mentor
  // co-sign for supervisors.
  uploadSignature: (file: File) => {
    const fd = new FormData()
    fd.append('signature', file)
    return apiClient
      .post<ApiResponse<User>>('/profile/signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.data)
  },

  removeSignature: () =>
    apiClient.delete<ApiResponse<User>>('/profile/signature').then((r) => r.data.data),

  updatePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    apiClient.put('/profile/password', data).then((r) => r.data),

  // Profile → Security: this account's logins, and signing them out.
  sessions: () =>
    apiClient.get<ApiResponse<ProfileSession[]>>('/profile/sessions').then((r) => r.data.data),

  revokeSession: (id: number) =>
    apiClient.delete<{ message: string }>(`/profile/sessions/${id}`).then((r) => r.data),

  revokeOtherSessions: () =>
    apiClient.delete<ApiResponse<{ count: number }>>('/profile/sessions/others').then((r) => r.data),

  // Profile → Activity: what you did yourself (your audit entries).
  myActivity: (page = 1) =>
    apiClient.get<PaginatedResponse<MyActivityEntry>>('/profile/activity', { params: { page } }).then((r) => r.data),
}
