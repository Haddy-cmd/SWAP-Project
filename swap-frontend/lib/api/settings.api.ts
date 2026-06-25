import apiClient from './axios'

export interface ApplicationStatus {
  open: boolean
  message: string | null
}

export interface AdminSettings {
  applications_open: boolean
  applications_closed_message: string
}

export const settingsApi = {
  // Public — used by the apply screen to know if the period is open.
  getApplicationStatus: () =>
    apiClient.get<{ data: ApplicationStatus }>('/settings/application-status').then((r) => r.data.data),

  // Admin
  getSettings: () =>
    apiClient.get<{ data: AdminSettings }>('/admin/settings').then((r) => r.data.data),

  updateSettings: (data: { applications_open: boolean; applications_closed_message?: string }) =>
    apiClient.put<{ data: AdminSettings; message: string }>('/admin/settings', data).then((r) => r.data),
}
