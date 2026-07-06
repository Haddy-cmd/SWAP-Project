import apiClient from './axios'
import type { TimeLog, HoursSummary, NarrativeReport, StoreNarrativeData, VerifyLogData } from '@/types/attendance.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const attendanceApi = {
  getCurrentLog: () =>
    apiClient.get<{ data: TimeLog | null }>('/recipient/attendance/current').then((r) => r.data.data),

  getMyAssignment: () =>
    apiClient.get<{ data: import('@/types/assignment.types').Assignment | null }>('/recipient/assignment').then((r) => r.data.data),

  getMyLogs: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TimeLog>>('/recipient/attendance/logs', { params }).then((r) => r.data),

  timeInGeofence: (qrToken: string, coords?: { latitude: number; longitude: number; accuracy?: number }) =>
    apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-in-geofence', {
      qr_token: qrToken, ...coords,
    }).then((r) => r.data),

  timeOut: (logId: number, qrToken: string, coords?: { latitude: number; longitude: number; accuracy?: number }) =>
    apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-out', {
      log_id: logId, qr_token: qrToken, ...coords,
    }).then((r) => r.data),

  autoClockOut: (logId: number, coords?: { latitude: number; longitude: number; accuracy?: number }) =>
    apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/auto-clock-out', {
      log_id: logId, ...coords,
    }).then((r) => r.data),

  submitNarrative: (logId: number, data: StoreNarrativeData) =>
    apiClient.post<ApiResponse<NarrativeReport>>(`/recipient/narratives`, { ...data, time_log_id: logId }).then((r) => r.data),

  getNarrative: (logId: number) =>
    apiClient.get<ApiResponse<NarrativeReport>>(`/recipient/narratives/${logId}`).then((r) => r.data.data),

  getHoursSummary: () =>
    apiClient.get<ApiResponse<HoursSummary>>('/recipient/hours/summary').then((r) => r.data.data),

  // Supervisor endpoints
  getSupervisorStudents: () =>
    apiClient.get('/supervisor/students').then((r) => r.data),

  getClockedInStudents: () =>
    apiClient.get<{ data: TimeLog[] }>('/supervisor/students/clocked-in').then((r) => r.data.data),

  getStudentSummary: (studentId: number) =>
    apiClient.get<{ data: HoursSummary; student: { id: number; name: string; email?: string; office?: string | null; academic_year?: string; semester?: string; required_hours?: number } }>(`/supervisor/students/${studentId}/summary`).then((r) => r.data),

  getStudentLogs: (studentId: number, params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TimeLog> & { student?: { id: number; name: string; required_hours?: number; pending_required_hours?: number | null } }>(`/supervisor/students/${studentId}/logs`, { params }).then((r) => r.data),

  addManualHours: (studentId: number, data: { hours: number; date: string; reason: string }) =>
    apiClient.post<ApiResponse<TimeLog>>(`/supervisor/students/${studentId}/manual-hours`, data).then((r) => r.data.data),

  updateRequiredHours: (studentId: number, required_hours: number) =>
    apiClient.put(`/supervisor/students/${studentId}/required-hours`, { required_hours }).then((r) => r.data),

  decideRequiredHours: (studentId: number, action: 'approve' | 'reject') =>
    apiClient.post(`/supervisor/students/${studentId}/required-hours/decision`, { action }).then((r) => r.data),

  getPendingVerifications: () =>
    apiClient.get<{ data: TimeLog[]; meta: { total: number } }>('/supervisor/verifications/pending').then((r) => r.data.data),

  getReviewedVerifications: () =>
    apiClient.get<{ data: TimeLog[]; meta: { total: number } }>('/supervisor/verifications/reviewed').then((r) => r.data.data),

  verifyLog: (logId: number, data: VerifyLogData) =>
    apiClient.put<ApiResponse<TimeLog>>(`/supervisor/verifications/${logId}`, data).then((r) => r.data),

  verifyLogsBulk: (logIds: number[]) =>
    apiClient.post<{ message: string; meta: { verified: number; skipped: number } }>(
      '/supervisor/verifications/bulk', { log_ids: logIds },
    ).then((r) => r.data),
}
