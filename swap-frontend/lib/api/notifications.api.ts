import apiClient from './axios'
import type { Notification } from '@/types/notification.types'
import type { PaginatedResponse } from '@/types/api.types'

export const notificationsApi = {
  getNotifications: (page = 1) =>
    apiClient.get<PaginatedResponse<Notification>>('/notifications', { params: { page } }).then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    apiClient.put('/notifications/read-all').then((r) => r.data),
}
