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
    <div className="mx-auto max-w-[720px] px-4 py-6">
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-[#EAE1D5]" />
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-[#EAE1D5]" />)}
          </div>
        </div>
      ) : (
        <NotificationList notifications={data?.data ?? []} />
      )}
    </div>
  )
}
