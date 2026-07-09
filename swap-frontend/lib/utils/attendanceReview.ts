import type { TimeLog } from '@/types/attendance.types'

/**
 * A pending log that shouldn't be rubber-stamped: either the server flagged its
 * location (weak GPS / reused coordinates / improbable travel), or there's no
 * proof-of-presence selfie. Manual/bonus entries are exempt — a supervisor or
 * admin created them, so they never have a clock-in photo or GPS fix.
 */
export function needsReview(log: TimeLog): boolean {
  if (log.is_manual) return false
  return !!log.location_flagged || !log.time_in_photo_url
}

/** Short human reason a log needs a closer look, or null when it's clean. */
export function reviewReason(log: TimeLog): string | null {
  if (!needsReview(log)) return null
  if (log.location_flagged) return log.location_flag_reason || 'location could not be verified'
  return 'no clock-in selfie'
}
