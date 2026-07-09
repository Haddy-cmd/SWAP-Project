import type { TimeLog } from '@/types/attendance.types'

/**
 * A pending log worth a second glance: either the server flagged its location
 * (weak GPS / reused coordinates / improbable travel), or there's no
 * proof-of-presence selfie. Manual/bonus entries are exempt — a supervisor or
 * admin created them, so they never have a clock-in photo or GPS fix.
 *
 * Surfacing only. Use blocksBulkVerify() to decide what can be selected.
 */
export function needsReview(log: TimeLog): boolean {
  if (log.is_manual) return false
  return !!log.location_flagged || !log.time_in_photo_url
}

/**
 * A log the supervisor must open and decide individually — never sweep up in a
 * bulk approval. Mirrors VerificationService::bulkVerify() exactly, so the UI
 * and the server agree on one rule.
 *
 * Deliberately narrower than needsReview(): a missing selfie is a weak signal
 * (the camera may simply have been denied, and every log predating the selfie
 * feature has none), whereas a location flag is a real server-side finding.
 */
export function blocksBulkVerify(log: TimeLog): boolean {
  return !log.is_manual && !!log.location_flagged
}

/** Short human reason a log needs a closer look, or null when it's clean. */
export function reviewReason(log: TimeLog): string | null {
  if (!needsReview(log)) return null
  if (log.location_flagged) return log.location_flag_reason || 'location could not be verified'
  return 'no clock-in selfie'
}
