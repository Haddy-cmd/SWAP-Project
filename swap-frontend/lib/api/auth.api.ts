import apiClient from './axios'
import type { AuthResponse, LoginCredentials, RegisterData, User } from '@/types/auth.types'
import type { ApiResponse } from '@/types/api.types'

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (data: { token: string; email: string; password: string; password_confirmation: string }) =>
    apiClient.post('/auth/reset-password', data).then((r) => r.data),

  // Staff invitation (public): describe the invite, then accept it to create the account.
  getInvitation: (token: string) =>
    apiClient
      .get<ApiResponse<{ email: string; name: string | null; role: string; office: string | null; expires_at: string }>>(`/invitations/${token}`)
      .then((r) => r.data.data),

  acceptInvitation: (token: string, data: { name: string; password: string; password_confirmation: string }) =>
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

  updatePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    apiClient.put('/profile/password', data).then((r) => r.data),
}
