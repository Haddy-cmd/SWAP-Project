'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { notificationsApi } from '@/lib/api/notifications.api'
import { useAuthStore } from '@/lib/store/authStore'
import { notificationLink } from '@/lib/utils/notificationLink'
import type { Notification } from '@/types/notification.types'

interface NotificationListProps {
  notifications: Notification[]
}

export function NotificationList({ notifications }: NotificationListProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  // Same behaviour as before: clicking an unread item marks it read; there's no
  // "mark unread" on the backend, so read items are inert.
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const total = notifications.length
  const unread = notifications.filter((n) => !n.is_read).length
  const hasUnread = unread > 0
  const list = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications

  // Clicking marks an unread item read, then navigates to the related transaction.
  const open = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id)
    const href = notificationLink(n, role)
    if (href) router.push(href)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-[26px] font-medium text-ink-950 sm:text-[32px]">Notifications</h1>
          <span className="text-[13.5px] text-ink-400">
            {hasUnread ? `${unread} unread of ${total}` : `All read · ${total} total`}
          </span>
        </div>
        <button
          onClick={() => hasUnread && markAll.mutate()}
          disabled={!hasUnread || markAll.isPending}
          className="whitespace-nowrap text-[13px] font-semibold transition-colors disabled:cursor-default"
          style={{ color: hasUnread ? '#1F5B3A' : '#ADB5A8' }}
        >
          Mark all read
        </button>
      </div>

      {/* Filter */}
      <div className="mt-2.5 flex justify-end gap-4 border-b border-ink-200 pb-3.5">
        {(['all', 'unread'] as const).map((key) => {
          const on = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="pb-[3px] text-[12.5px] transition-colors"
              style={{
                fontWeight: on ? 700 : 500,
                color: on ? '#13241A' : '#8C968F',
                borderBottom: `1.5px solid ${on ? '#1F5B3A' : 'transparent'}`,
              }}
            >
              {key === 'all' ? 'All' : 'Unread'} {key === 'all' ? total : unread}
            </button>
          )
        })}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="px-5 py-[70px] text-center">
          <p className="font-serif text-[22px] text-ink-700">You&apos;re all caught up.</p>
          <p className="mt-1.5 text-[13.5px] text-ink-400">
            {total === 0 ? 'You have no notifications yet.' : 'No unread notifications right now.'}
          </p>
        </div>
      ) : (
        <div>
          {list.map((n) => {
            const isUnread = !n.is_read
            const clickable = isUnread || notificationLink(n, role) !== null
            return (
              <div
                key={n.id}
                onClick={() => open(n)}
                className={`-mx-2 flex items-start gap-3.5 rounded-lg border-b border-ink-100 px-3 py-[17px] transition-colors ${clickable ? 'cursor-pointer hover:bg-ink-50' : ''}`}
              >
                <span className="mt-[7px] h-[7px] w-[7px] flex-none rounded-full" style={{ background: isUnread ? '#1F5B3A' : 'transparent' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px]" style={{ fontWeight: isUnread ? 700 : 500, color: isUnread ? '#13241A' : '#34433A' }}>
                    {n.data.title}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-[1.45] text-ink-500">{n.data.message}</div>
                </div>
                <span className="mt-px flex-none whitespace-nowrap text-[12px] tabular-nums text-ink-400">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
