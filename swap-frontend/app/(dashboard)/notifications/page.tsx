'use client'

import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/notifications.api'
import { NotificationList } from '@/components/notifications/NotificationList'

export default function NotificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.getNotifications(1),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1E293B]">Notifications</h1>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-[#E2E8F0]" />)}
        </div>
      ) : (
        <NotificationList notifications={data?.data ?? []} />
      )}
    </div>
  )
}
