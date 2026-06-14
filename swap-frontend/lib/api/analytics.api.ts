import apiClient from './axios'
import type { AdminOverview } from '@/types/analytics.types'
import type { ApiResponse } from '@/types/api.types'

export const analyticsApi = {
  getAdminOverview: (academicYear: string, semester: string) =>
    apiClient.get<ApiResponse<AdminOverview>>('/admin/analytics/overview', {
      params: { academic_year: academicYear, semester },
    }).then((r) => r.data.data),

  getAuditLogs: (page = 1) =>
    apiClient.get('/admin/audit-logs', { params: { page } }).then((r) => r.data),
}
