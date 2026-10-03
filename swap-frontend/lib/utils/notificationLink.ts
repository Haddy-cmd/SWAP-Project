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
    case 'assignment': // placed at / moved to an office → dashboard shows office + supervisor
      return role === 'admin' ? '/admin/assignments' : '/recipient/dashboard'
    case 'attendance': // hours verified / rejected → the recipient's hours
      return '/recipient/hours'
    case 'verification': // a recipient's hours awaiting the supervisor
      return '/supervisor/verifications'
    case 'approval': // admin: a required-hours change request
      return '/admin/assignments'
    case 'concern': // new concern (admin) / the DSA replied (sender)
      return role === 'admin' ? '/admin/concerns' : '/help'
    case 'term': // the term was judged deficient / re-qualified → promissory note + stipend
      return '/recipient/stipend'
    case 'promissory': // a note submitted (supervisor) / reviewed (student)
      return role === 'supervisor' ? '/supervisor/promissory' : '/recipient/stipend'
    case 'term_report': // a report submitted (supervisor) / accepted (student)
      return role === 'supervisor' ? '/supervisor/students' : '/recipient/hours'
    case 'announcement': // opens in a popup (AnnouncementModal), not a page
      return null
    default:
      return null
  }
}
