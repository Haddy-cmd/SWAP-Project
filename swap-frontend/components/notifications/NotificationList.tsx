'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { notificationsApi as notificationApi } from '@/lib/api/notifications.api'
import type { Notification } from '@/types/notification.types'

interface NotificationListProps {
  notifications: Notification[]
}

export function NotificationList({ notifications }: NotificationListProps) {
  const queryClient = useQueryClient()

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Bell className="h-10 w-10 text-[#CBD5E1]" />
        <p className="text-sm font-medium text-[#94A3B8]">No notifications yet</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#64748B]">{notifications.length} notification(s)</p>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1B4F72] hover:text-[#2980B9] disabled:opacity-50 transition-colors"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            onClick={() => !n.is_read && markRead.mutate(n.id)}
            className={`cursor-pointer rounded-xl border p-4 transition-colors ${
              n.is_read
                ? 'border-[#E2E8F0] bg-white'
                : 'border-[#2980B9]/20 bg-[#EBF5FB] hover:bg-[#D6EAF8]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${n.is_read ? 'text-[#64748B]' : 'text-[#1B4F72]'}`}>
                  {n.data.title}
                </p>
                <p className="mt-0.5 text-xs text-[#64748B] line-clamp-2">{n.data.message}</p>
              </div>
              {!n.is_read && (
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#1B4F72]" />
              )}
            </div>
            <p className="mt-2 text-xs text-[#94A3B8]">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
