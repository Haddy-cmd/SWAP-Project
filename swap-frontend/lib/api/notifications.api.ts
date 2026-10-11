import apiClient from './axios'
import type { Notification } from '@/types/notification.types'
import type { PaginatedResponse } from '@/types/api.types'

export const notificationsApi = {
  getNotifications: (page = 1, perPage = 15) =>
    apiClient.get<PaginatedResponse<Notification> & { meta: { unread_count?: number } }>('/notifications', { params: { page, per_page: perPage } }).then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    apiClient.put('/notifications/read-all').then((r) => r.data),
}
