/**
 * Seconds counted on an open shift: from clock-in to now, minus time away from the office
 * (away_seconds, from earlier absences). While the student is away right now (left_premises_at)
 * the count stops at the moment they left, so every shift timer pauses until they return —
 * the same rule as the server's duration_hours.
 */
export function shiftSeconds(
  log: { time_in: string; left_premises_at?: string | null; away_seconds?: number | null },
  now: number,
): number {
  const end = log.left_premises_at ? new Date(log.left_premises_at).getTime() : now
  return Math.max(0, Math.floor((end - new Date(log.time_in).getTime()) / 1000) - (log.away_seconds ?? 0))
}

/** HH:MM:SS */
export function clockLabel(secs: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`
}
