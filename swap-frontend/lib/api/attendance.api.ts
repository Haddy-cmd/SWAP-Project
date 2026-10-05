import apiClient from './axios'
import type { TimeLog, HoursSummary, NarrativeReport, StoreNarrativeData, VerifyLogData, TermReport, TermReportMeta } from '@/types/attendance.types'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { Pace } from '@/lib/utils/pace'

export const attendanceApi = {
  getCurrentLog: () =>
    apiClient.get<{ data: TimeLog | null }>('/recipient/attendance/current').then((r) => r.data.data),

  getMyAssignment: () =>
    apiClient.get<{ data: import('@/types/assignment.types').Assignment | null }>('/recipient/assignment').then((r) => r.data.data),

  // The current term's logs by default; pass { scope: 'all' } for every term (duty slip).
  getMyLogs: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TimeLog>>('/recipient/attendance/logs', { params }).then((r) => r.data),

  // Earlier terms with their hours, verdict and stipend (Hours page → Past terms).
  getProgress: () =>
    apiClient.get<{ data: import('@/types/attendance.types').RecipientProgress | null }>('/recipient/progress').then((r) => r.data.data),

  getTermHistory: () =>
    apiClient.get<{ data: import('@/types/assignment.types').TermHistoryItem[] }>('/recipient/assignments/history').then((r) => r.data.data),

  timeInGeofence: (qrToken: string, coords?: { latitude: number; longitude: number; accuracy?: number }, photo?: Blob) => {
    // With a proof-of-presence selfie, send multipart; otherwise a plain JSON body.
    if (photo) {
      const fd = new FormData()
      fd.append('qr_token', qrToken)
      if (coords) {
        fd.append('latitude', String(coords.latitude))
        fd.append('longitude', String(coords.longitude))
        if (coords.accuracy != null) fd.append('accuracy', String(coords.accuracy))
      }
      fd.append('photo', new File([photo], 'selfie.jpg', { type: 'image/jpeg' }))
      return apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-in-geofence', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data)
    }
    return apiClient.post<ApiResponse<TimeLog>>('/recipient/attendance/time-in-geofence', {
      qr_token: qrToken, ...coords,
    }).then((r) => r.data)
  },

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
    apiClient.get<{ data: HoursSummary; student: { id: number; name: string; avatar_url?: string | null; student_id_number?: string | null; email?: string; program?: string | null; year_level?: number | null; office?: string | null; supervisor?: string | null; signature_url?: string | null; supervisor_signature_url?: string | null; academic_year?: string; semester?: string; required_hours?: number; carried_over_hours?: number; pace?: Pace }; term_report?: TermReport | null; term?: import('@/types/assignment.types').StudentTerm; assignment_id?: number; hours_met?: boolean }>(`/supervisor/students/${studentId}/summary`).then((r) => r.data),

  // The supervisor accepts the end-of-term report, marking the student eligible or not for renewal.
  reviewTermReport: (assignmentId: number, data: { renewal_eligible: boolean; remarks: string | null }) =>
    apiClient.put<{ data: TermReport; message: string }>(`/supervisor/assignments/${assignmentId}/term-report/review`, data).then((r) => r.data),

  // The recipient's end-of-term narrative report (required before the stipend is released).
  getTermReport: () =>
    apiClient.get<{ data: TermReport | null; meta: TermReportMeta }>('/recipient/term-report').then((r) => r.data),

  saveTermReport: (data: { content: string; accomplishments?: string | null; challenges?: string | null }) =>
    apiClient.put<ApiResponse<TermReport>>('/recipient/term-report', data).then((r) => r.data),

  getStudentLogs: (studentId: number, params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TimeLog> & { student?: { id: number; name: string; required_hours?: number; pending_required_hours?: number | null } }>(`/supervisor/students/${studentId}/logs`, { params }).then((r) => r.data),

  addManualHours: (studentId: number, data: { hours: number; date: string; reason: string }) =>
    apiClient.post<ApiResponse<TimeLog>>(`/supervisor/students/${studentId}/manual-hours`, data).then((r) => r.data.data),

  // Supervisor marks the student's current term deficient (reason goes to the student).
  markDeficient: (studentId: number, reason: string) =>
    apiClient.post<{ message: string; term: import('@/types/assignment.types').StudentTerm }>(`/supervisor/students/${studentId}/mark-deficient`, { reason }).then((r) => r.data),

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
