import apiClient from './axios'
import type { TimeLog, HoursSummary, NarrativeReport, StoreNarrativeData, VerifyLogData } from '@/types/attendance.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'

export const attendanceApi = {
  getCurrentLog: () =>
    apiClient.get<{ data: TimeLog | null }>('/recipient/attendance/current').then((r) => r.data.data),

  timeIn: (qrToken: string) =>
    apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-in', { qr_token: qrToken }).then((r) => r.data),

  timeOut: (logId: number, qrToken: string) =>
    apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-out', { log_id: logId, qr_token: qrToken }).then((r) => r.data),

  submitNarrative: (logId: number, data: StoreNarrativeData) =>
    apiClient.post<ApiResponse<NarrativeReport>>(`/recipient/narratives`, { ...data, time_log_id: logId }).then((r) => r.data),

  getNarrative: (logId: number) =>
    apiClient.get<ApiResponse<NarrativeReport>>(`/recipient/narratives/${logId}`).then((r) => r.data.data),

  getHoursSummary: () =>
    apiClient.get<ApiResponse<HoursSummary>>('/recipient/hours/summary').then((r) => r.data.data),

  // Supervisor endpoints
  getSupervisorStudents: () =>
    apiClient.get('/supervisor/students').then((r) => r.data),

  getStudentSummary: (studentId: number) =>
    apiClient.get<{ data: HoursSummary; student: { id: number; name: string } }>(`/supervisor/students/${studentId}/summary`).then((r) => r.data),

  getStudentLogs: (studentId: number, params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TimeLog> & { student?: { id: number; name: string } }>(`/supervisor/students/${studentId}/logs`, { params }).then((r) => r.data),

  verifyLog: (logId: number, data: VerifyLogData) =>
    apiClient.put<ApiResponse<TimeLog>>(`/supervisor/verifications/${logId}`, data).then((r) => r.data),
}
