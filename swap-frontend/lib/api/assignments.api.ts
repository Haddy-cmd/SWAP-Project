import apiClient from './axios'
import type { Assignment, CreateAssignmentData, Office } from '@/types/assignment.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const assignmentsApi = {
  getAssignments: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Assignment>>('/admin/assignments', { params }).then((r) => r.data),

  createAssignment: (data: CreateAssignmentData) =>
    apiClient.post<ApiResponse<Assignment>>('/admin/assignments', data).then((r) => r.data.data),

  updateAssignment: (id: number, data: Partial<Assignment>) =>
    apiClient.put<ApiResponse<Assignment>>(`/admin/assignments/${id}`, data).then((r) => r.data.data),

  regenerateQr: (id: number) =>
    apiClient.post<ApiResponse<{ qr_code: string }>>(`/admin/assignments/${id}/regenerate-qr`).then((r) => r.data),

  getOffices: () =>
    apiClient.get<{ data: Office[] }>('/admin/offices').then((r) => r.data),

  createOffice: (data: Partial<Office>) =>
    apiClient.post<ApiResponse<Office>>('/admin/offices', data).then((r) => r.data.data),

  updateOffice: (id: number, data: Partial<Office>) =>
    apiClient.put<ApiResponse<Office>>(`/admin/offices/${id}`, data).then((r) => r.data.data),

  deleteOffice: (id: number) =>
    apiClient.delete(`/admin/offices/${id}`).then((r) => r.data),
}
