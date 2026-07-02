'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { notificationsApi } from '@/lib/api/notifications.api'
import type { Notification } from '@/types/notification.types'

interface NotificationListProps {
  notifications: Notification[]
}

export function NotificationList({ notifications }: NotificationListProps) {
  const queryClient = useQueryClient()
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-[32px] font-medium text-[#1F1512]">Notifications</h1>
          <span className="text-[13.5px] text-[#A89A8F]">
            {hasUnread ? `${unread} unread of ${total}` : `All read · ${total} total`}
          </span>
        </div>
        <button
          onClick={() => hasUnread && markAll.mutate()}
          disabled={!hasUnread || markAll.isPending}
          className="whitespace-nowrap text-[13px] font-semibold transition-colors disabled:cursor-default"
          style={{ color: hasUnread ? '#7C1B26' : '#C4B4A4' }}
        >
          Mark all read
        </button>
      </div>

      {/* Filter */}
      <div className="mt-2.5 flex justify-end gap-4 border-b border-[#ECE4D8] pb-3.5">
        {(['all', 'unread'] as const).map((key) => {
          const on = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="pb-[3px] text-[12.5px] transition-colors"
              style={{
                fontWeight: on ? 700 : 500,
                color: on ? '#1F1512' : '#A89A8F',
                borderBottom: `1.5px solid ${on ? '#7C1B26' : 'transparent'}`,
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
          <p className="font-serif text-[22px] text-[#3F2F2A]">You&apos;re all caught up.</p>
          <p className="mt-1.5 text-[13.5px] text-[#A89A8F]">
            {total === 0 ? 'You have no notifications yet.' : 'No unread notifications right now.'}
          </p>
        </div>
      ) : (
        <div>
          {list.map((n) => {
            const isUnread = !n.is_read
            return (
              <div
                key={n.id}
                onClick={() => isUnread && markRead.mutate(n.id)}
                className={`flex items-start gap-3.5 border-b border-[#F1EBE1] px-1 py-[17px] ${isUnread ? 'cursor-pointer' : ''}`}
              >
                <span className="mt-[7px] h-[7px] w-[7px] flex-none rounded-full" style={{ background: isUnread ? '#7C1B26' : 'transparent' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px]" style={{ fontWeight: isUnread ? 700 : 500, color: isUnread ? '#1F1512' : '#4A3A34' }}>
                    {n.data.title}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-[1.45] text-[#7A6A63]">{n.data.message}</div>
                </div>
                <span className="mt-px flex-none whitespace-nowrap text-[12px] tabular-nums text-[#B0A192]">
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
