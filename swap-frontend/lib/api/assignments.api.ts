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

  addManualHours: (id: number, data: { hours: number; date: string; reason: string }) =>
    apiClient.post(`/admin/assignments/${id}/manual-hours`, data).then((r) => r.data),

  requestRequiredHours: (id: number, required_hours: number) =>
    apiClient.post(`/admin/assignments/${id}/required-hours`, { required_hours }).then((r) => r.data),

  getOffices: () =>
    apiClient.get<{ data: Office[] }>('/admin/offices').then((r) => r.data),

  createOffice: (data: Partial<Office>) =>
    apiClient.post<ApiResponse<Office>>('/admin/offices', data).then((r) => r.data.data),

  updateOffice: (id: number, data: Partial<Office>) =>
    apiClient.put<ApiResponse<Office>>(`/admin/offices/${id}`, data).then((r) => r.data.data),

  deleteOffice: (id: number) =>
    apiClient.delete(`/admin/offices/${id}`).then((r) => r.data),

  generateOfficeQr: (id: number) =>
    apiClient.post<ApiResponse<{ qr_code: string }>>(`/admin/offices/${id}/qr`).then((r) => r.data),

  getOfficeSupervisors: (id: number) =>
    apiClient.get<{ data: import('@/types/auth.types').User[] }>(`/admin/offices/${id}/supervisors`).then((r) => r.data.data),

  assignSupervisorToOffice: (id: number, supervisorId: number) =>
    apiClient.post(`/admin/offices/${id}/supervisors`, { supervisor_id: supervisorId }).then((r) => r.data),

  removeSupervisorFromOffice: (id: number, supervisorId: number) =>
    apiClient.delete(`/admin/offices/${id}/supervisors/${supervisorId}`).then((r) => r.data),
}
