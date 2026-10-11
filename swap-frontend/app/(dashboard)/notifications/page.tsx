'use client'

import { NotificationList } from '@/components/notifications/NotificationList'

/** Notifications for every role (layout "SWAP Admin Notifications v2"). */
export default function NotificationsPage() {
  return (
    <div className="px-1 py-2 sm:px-4 sm:py-4">
      <NotificationList />
    </div>
  )
}
