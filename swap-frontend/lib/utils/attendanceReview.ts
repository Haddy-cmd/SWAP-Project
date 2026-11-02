import type { TimeLog } from '@/types/attendance.types'

/**
 * A pending log worth a second glance: either the server flagged its location
 * (weak GPS / reused coordinates / improbable travel), or there's no
 * proof-of-presence selfie although one was required when the shift started
 * (the supervisor can turn the selfie off). Manual/bonus entries are exempt — a
 * supervisor or admin created them, so they never have a clock-in photo or GPS fix.
 *
 * Surfacing only. Use blocksBulkVerify() to decide what can be selected.
 */
export function needsReview(log: TimeLog): boolean {
  if (log.is_manual) return false
  return !!log.location_flagged || (!log.time_in_photo_url && log.selfie_required !== false)
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

/** How long the clock-out label stays on a flagged log; after this it resets (disappears). */
export const CLOCKED_OUT_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * "Clocked out just now / 5 min ago / 3 h ago" for a log's time-out, or null when there is
 * none or it was 12 hours ago or more.
 */
export function clockedOutAgo(timeOut: string | null | undefined, now: number): string | null {
  if (!timeOut) return null
  const ms = now - new Date(timeOut).getTime()
  if (Number.isNaN(ms) || ms < 0 || ms >= CLOCKED_OUT_WINDOW_MS) return ms < 0 ? 'Clocked out just now' : null
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'Clocked out just now'
  if (min < 60) return `Clocked out ${min} min ago`
  return `Clocked out ${Math.floor(min / 60)} h ago`
}

/** Short human reason a log needs a closer look, or null when it's clean. */
export function reviewReason(log: TimeLog): string | null {
  if (!needsReview(log)) return null
  if (log.location_flagged) return log.location_flag_reason || 'location could not be verified'
  return 'no clock-in selfie'
}
