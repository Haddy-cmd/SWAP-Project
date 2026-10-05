import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'

export interface SupervisorSettings {
  require_clock_in_selfie: boolean
}

export interface OfficeQr {
  office: { id: number; name: string; location: string | null }
  qr_code: string
}

export interface StudentDocument {
  id: number
  document_type: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  application_id: number
  academic_year: string | null
  semester: string | null
  type: 'new' | 'renewal'
}

export interface RosterSummary {
  title: string
  office: string
  supervisor: string
  headers: string[]
  rows: (string | number | null)[][]
  stats: { label: string; value: string }[]
  totals: { recipients: number; required: number; verified: number; pending: number; behind: number }
}

/** Supervisor → Reports → Insights (ReportService::supervisorInsights). */
export interface SupervisorInsights {
  students: number
  pending: number
  pending_hours: number
  oldest_pending_days: number | null
  /** Logs this supervisor verified in the last 30 days, and the average hours from clock-out to verification. */
  my_verified_30d: number
  my_avg_verify_hours: number | null
  avg_session_hours: number | null
  inactive_after_days: number
  /** No clock-in for `inactive_after_days` days, or never (`days` null). */
  inactive: { student_id: number; name: string; last_clock_in: string | null; days: number | null }[]
  auto_clock_outs: { student_id: number; name: string; count: number }[]
}

export const supervisorApi = {
  // The signed attendance QR for the supervisor's assigned office.
  getOfficeQr: () =>
    apiClient.get<ApiResponse<OfficeQr>>('/supervisor/office-qr').then((r) => r.data.data),

  // Application documents of a recipient this supervisor manages.
  getStudentDocuments: (studentId: number) =>
    apiClient.get<ApiResponse<StudentDocument[]>>(`/supervisor/students/${studentId}/documents`).then((r) => r.data.data),

  // End-of-semester roster summary — the sheet the supervisor hands to the DSA.
  getRosterSummary: () =>
    apiClient.get<ApiResponse<RosterSummary>>('/supervisor/reports/roster').then((r) => r.data.data),

  getInsights: () =>
    apiClient.get<ApiResponse<SupervisorInsights>>('/supervisor/reports/insights').then((r) => r.data.data),

  exportRosterCsv: () =>
    apiClient.get<Blob>('/supervisor/reports/roster/export', { responseType: 'blob' }).then((r) => r.data),

  getSettings: () =>
    apiClient.get<ApiResponse<SupervisorSettings>>('/supervisor/settings').then((r) => r.data.data),

  updateSettings: (data: SupervisorSettings) =>
    apiClient.put<ApiResponse<SupervisorSettings> & { message: string }>('/supervisor/settings', data).then((r) => r.data),
}
