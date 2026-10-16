'use client'

import { NotificationList } from '@/components/notifications/NotificationList'
import { BackLink } from '@/components/shared/BackLink'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'

/** Notifications for every role (layout "SWAP Admin Notifications v2"). Reached from the bell, so Back returns there. */
export default function NotificationsPage() {
  const role = useAuthStore((s) => s.user?.role)

  return (
    <div className="px-1 py-2 sm:px-4 sm:py-4">
      <BackLink href={role ? getRoleDashboard(role) : '/'} history className="mb-3" />
      <NotificationList />
    </div>
  )
}
