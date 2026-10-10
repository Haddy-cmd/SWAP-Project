import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { Announcement, AnnouncementListMeta } from '@/types/announcement.types'

/**
 * An announcement file's address for <img src> / a new tab: the API base plus the
 * file path, with the sign-in token (the endpoint checks who may open it).
 */
export function announcementFileUrl(path: string, token?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
  return `${base}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export const announcementsApi = {
  // Sent history, newest first; meta.active_recipients = who a new one would reach.
  list: (page = 1, search = '') =>
    apiClient
      .get<{ data: Announcement[]; meta: AnnouncementListMeta }>('/admin/announcements', {
        params: { page, ...(search.trim() && { search: search.trim() }) },
      })
      .then((r) => r.data),

  // Sends to every active recipient: portal notification + email. Files go as multipart.
  send: (data: { title: string; message: string; files?: File[] }) => {
    if (!data.files?.length) {
      return apiClient.post<ApiResponse<Announcement>>('/admin/announcements', { title: data.title, message: data.message }).then((r) => r.data)
    }
    const form = new FormData()
    form.append('title', data.title)
    form.append('message', data.message)
    data.files.forEach((f) => form.append('attachments[]', f))
    return apiClient.post<ApiResponse<Announcement>>('/admin/announcements', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  // Removes it from the history and every recipient's notifications (emails can't be recalled).
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/admin/announcements/${id}`).then((r) => r.data),
}
