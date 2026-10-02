import apiClient from './axios'

export interface ApplicationStatus {
  open: boolean
  message: string | null
  // Derived from the semester period renewal is open for (Admin → Semesters).
  renewal: {
    open: boolean
    academic_year: string | null
    semester: string | null
  }
}

export interface AdminSettings {
  applications_open: boolean
  applications_closed_message: string
}

export const settingsApi = {
  // Public — used by the apply screen (period open?) and the renewal page (window + target term).
  getApplicationStatus: () =>
    apiClient.get<{ data: ApplicationStatus }>('/settings/application-status').then((r) => r.data.data),

  // Admin
  getSettings: () =>
    apiClient.get<{ data: AdminSettings }>('/admin/settings').then((r) => r.data.data),

  updateSettings: (data: Partial<{
    applications_open: boolean
    applications_closed_message: string
  }>) =>
    apiClient.put<{ data: AdminSettings; message: string }>('/admin/settings', data).then((r) => r.data),
}
