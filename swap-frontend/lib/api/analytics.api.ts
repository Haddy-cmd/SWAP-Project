import apiClient from './axios'
import { filenameFrom, rethrowBlobError } from './reports.api'
import type { AdminOverview, AdminPeriod, ProgramInsights, SupervisorReminderResult } from '@/types/analytics.types'
import type { ApiResponse } from '@/types/api.types'
import type { AuditFilters, AuditOptions, AuditPage } from '@/types/audit.types'

export const analyticsApi = {
  getAdminOverview: (academicYear: string, semester: string) =>
    apiClient.get<ApiResponse<AdminOverview>>('/admin/analytics/overview', {
      params: { academic_year: academicYear, semester },
    }).then((r) => r.data.data),

  getInsights: (academicYear: string, semester: string) =>
    apiClient.get<ApiResponse<ProgramInsights>>('/admin/analytics/insights', {
      params: { academic_year: academicYear, semester },
    }).then((r) => r.data.data),

  getPeriods: () =>
    apiClient.get<ApiResponse<AdminPeriod[]>>('/admin/analytics/periods').then((r) => r.data.data),

  /** Supervisors tab: remind the busy supervisors of the term (each at most once a day). */
  remindSupervisors: (academicYear: string, semester: string) =>
    apiClient.post<ApiResponse<SupervisorReminderResult>>('/admin/analytics/remind-supervisors', {
      academic_year: academicYear, semester,
    }).then((r) => r.data.data),

}

// Admin → Audit Logs and the History panels (AuditLogService). Empty filters are dropped.
export const auditApi = {
  list: (filters: AuditFilters) =>
    apiClient.get<AuditPage>('/admin/audit-logs', {
      params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')),
    }).then((r) => r.data),

  options: () => apiClient.get<{ data: AuditOptions }>('/admin/audit-logs/options').then((r) => r.data.data),

  // Audit Logs → CSV: every entry the filters match (not just one page); over 20,000 is refused.
  export: (filters: AuditFilters) =>
    apiClient.get<Blob>('/admin/audit-logs/export', {
      params: Object.fromEntries(Object.entries(filters).filter(([k, v]) => k !== 'page' && v !== undefined && v !== '')),
      responseType: 'blob',
    })
      .then((r) => ({ blob: r.data, filename: filenameFrom(r.headers['content-disposition']) }))
      .catch(rethrowBlobError),
}
