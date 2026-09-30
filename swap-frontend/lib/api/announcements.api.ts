import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { Announcement, AnnouncementListMeta } from '@/types/announcement.types'

export const announcementsApi = {
  // Sent history, newest first; meta.active_recipients = who a new one would reach.
  list: (page = 1) =>
    apiClient
      .get<{ data: Announcement[]; meta: AnnouncementListMeta }>('/admin/announcements', { params: { page } })
      .then((r) => r.data),

  // Sends to every active recipient: portal notification + email.
  send: (data: { title: string; message: string }) =>
    apiClient.post<ApiResponse<Announcement>>('/admin/announcements', data).then((r) => r.data),
}
