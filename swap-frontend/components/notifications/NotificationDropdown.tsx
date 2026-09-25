'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { CheckCheck, ArrowRight } from 'lucide-react'
import { notificationsApi as notificationApi } from '@/lib/api/notifications.api'
import { useAuthStore } from '@/lib/store/authStore'
import { notificationLink } from '@/lib/utils/notificationLink'
import type { Notification } from '@/types/notification.types'

interface NotificationDropdownProps {
  notifications: Notification[]
  onClose: () => void
}

export function NotificationDropdown({ notifications, onClose }: NotificationDropdownProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOne = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Same behaviour as the notifications page: mark read, then jump to the
  // related transaction (and close the dropdown).
  const open = (n: Notification) => {
    if (!n.is_read) markOne.mutate(n.id)
    const href = notificationLink(n, role)
    if (href) {
      onClose()
      router.push(href)
    }
  }

  const recent = notifications.slice(0, 5)

  return (
    <div className="fixed inset-x-3 top-[4.25rem] z-50 rounded-xl border border-ink-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-2rem)]">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink-900">Notifications</p>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 disabled:opacity-50 transition-colors"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          All read
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-ink-350">No notifications</p>
      ) : (
        <ul className="max-h-[65vh] overflow-y-auto">
          {recent.map((n) => (
            <li
              key={n.id}
              onClick={() => open(n)}
              className={`cursor-pointer border-b border-ink-100 px-4 py-3 last:border-0 transition-colors ${
                !n.is_read ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-ink-50'
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.is_read && (
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-danger-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-900">{n.data.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{n.data.message}</p>
                  <p className="mt-1 text-[10px] text-ink-350">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-ink-100 px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-600 transition-colors"
        >
          View all notifications
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
