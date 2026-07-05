import apiClient from './axios'
import type { Application, StoreApplicationData, ScheduleInterviewData, DecideApplicationData } from '@/types/application.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const applicationsApi = {
  // Applicant endpoints
  getMyApplications: () =>
    apiClient.get<ApiResponse<Application[]>>('/applicant/applications').then((r) => r.data.data),

  submitApplication: (data: StoreApplicationData) =>
    apiClient.post<ApiResponse<Application>>('/applicant/applications', data).then((r) => r.data.data),

  getApplication: (id: number) =>
    apiClient.get<ApiResponse<Application>>(`/applicant/applications/${id}`).then((r) => r.data.data),

  getApplicationStatus: (id: number) =>
    apiClient.get<ApiResponse<{ id: number; status: string; remarks: string | null; interview: unknown }>>(`/applicant/applications/${id}/status`).then((r) => r.data.data),

  // Semester renewal: the recipient's submission for the current renewal term (or null).
  getMyRenewal: () =>
    apiClient.get<ApiResponse<Application | null>>('/recipient/renewals').then((r) => r.data.data),

  // Semester renewal: one updated COR, no interview round.
  submitRenewal: (formData: FormData) =>
    apiClient.post<ApiResponse<Application>>('/recipient/renewals', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data),

  uploadDocument: (applicationId: number, formData: FormData) =>
    apiClient.post(`/applicant/applications/${applicationId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  // Roll back a freshly-submitted application (e.g. when document uploads fail).
  cancelApplication: (id: number) =>
    apiClient.delete(`/applicant/applications/${id}`).then((r) => r.data),

  // Admin endpoints
  adminListApplications: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Application>>('/admin/applications', { params }).then((r) => r.data),

  adminGetApplication: (id: number) =>
    apiClient.get<ApiResponse<Application>>(`/admin/applications/${id}`).then((r) => r.data.data),

  adminMarkUnderReview: (id: number) =>
    apiClient.put<ApiResponse<Application>>(`/admin/applications/${id}/review`).then((r) => r.data.data),

  adminScheduleInterview: (id: number, data: ScheduleInterviewData) =>
    apiClient.post<ApiResponse<Application>>(`/admin/applications/${id}/interview`, data).then((r) => r.data.data),

  adminRescheduleInterview: (id: number, data: ScheduleInterviewData) =>
    apiClient.put<ApiResponse<Application>>(`/admin/applications/${id}/interview`, data).then((r) => r.data.data),

  adminMarkInterviewNoShow: (id: number) =>
    apiClient.post<ApiResponse<Application>>(`/admin/applications/${id}/interview/no-show`).then((r) => r.data.data),

  adminDecideApplication: (id: number, data: DecideApplicationData) =>
    apiClient.put<ApiResponse<Application>>(`/admin/applications/${id}/decide`, data).then((r) => r.data.data),
}
