import type { Notification } from '@/types/notification.types'

/**
 * Where a notification should take the viewer when clicked. Routing depends on the
 * notification `type`, the IDs in its payload, and the viewer's role (the same
 * "application" notification points admins at the review page and applicants at
 * their own application). Returns null when there's no sensible destination.
 */
export function notificationLink(n: Notification, role?: string | null): string | null {
  const d = n.data ?? {}
  const type = String(d.type ?? '')
  const appId = d.application_id

  switch (type) {
    case 'application':
    case 'interview':
      if (appId == null) return null
      return role === 'admin' ? `/admin/applications/${appId}` : `/applicant/application/${appId}`
    case 'stipend':
      return role === 'admin' ? '/admin/stipend' : '/recipient/stipend'
    case 'attendance': // hours verified / rejected → the recipient's hours
      return '/recipient/hours'
    case 'verification': // a recipient's hours awaiting the supervisor
      return '/supervisor/verifications'
    case 'approval': // admin: a required-hours change request
      return '/admin/assignments'
    default:
      return null
  }
}
