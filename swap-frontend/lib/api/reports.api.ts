import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'

export const reportsApi = {
  getWeeklyReports: () =>
    apiClient.get<ApiResponse<unknown[]>>('/recipient/reports/weekly').then((r) => r.data.data),

  getMonthlyReports: () =>
    apiClient.get<ApiResponse<unknown[]>>('/recipient/reports/monthly').then((r) => r.data.data),

  getSemesterReport: () =>
    apiClient.get<ApiResponse<unknown>>('/recipient/reports/semester').then((r) => r.data.data),

  getStipendHistory: () =>
    apiClient.get('/recipient/stipend/history').then((r) => r.data),
}
