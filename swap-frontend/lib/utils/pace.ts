/**
 * Pace is decided server-side (Assignment::paceStatus) against the elapsed term, so
 * the roster, the student page and the CSV export can't disagree about who is behind.
 * This module only maps that status onto how it looks.
 */
export type PaceStatus = 'not_started' | 'behind' | 'on_track' | 'complete'

export interface Pace {
  status: PaceStatus
  percent: number
  /** Hours the elapsed term implies they should have by now. Null when the term has no end date. */
  expected_hours: number | null
  deficit_hours: number | null
}

export const PACE_META: Record<PaceStatus, { label: string; color: string; bg: string }> = {
  complete: { label: 'Complete', color: '#145643', bg: '#EFF8F4' },
  on_track: { label: 'On track', color: '#145643', bg: '#EFF8F4' },
  behind: { label: 'Behind pace', color: '#B45309', bg: '#FDF8E4' },
  not_started: { label: 'Not started', color: '#6F7B74', bg: '#ECEFE2' },
}

/** Defensive default for rows served before `pace` existed, or by an older API. */
export const UNKNOWN_PACE: Pace = { status: 'not_started', percent: 0, expected_hours: null, deficit_hours: null }

export const isBehind = (pace?: Pace | null): boolean => pace?.status === 'behind'

/** e.g. "18.5h behind schedule" — or a plain label when the term has no end date to measure against. */
export function paceDetail(pace: Pace): string {
  if (pace.status === 'complete') return 'Requirement complete'
  if (pace.status === 'not_started') return 'No verified hours yet'
  if (pace.status !== 'behind') return 'Keeping up with the term'
  if (pace.deficit_hours == null) return `Only ${pace.percent}% of required hours verified`
  return `${fmt(pace.deficit_hours)}h behind schedule`
}

const fmt = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))
