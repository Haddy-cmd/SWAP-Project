/**
 * Interview scheduling rules, mirroring the backend's App\Support\InterviewWindow.
 * Every calculation is pinned to Asia/Manila rather than the browser's timezone,
 * so a reviewer travelling (or a laptop with the wrong clock zone) still sees the
 * same slots the server will accept.
 */

export const MANILA_TZ = 'Asia/Manila'

export type InterviewMode = 'in_person' | 'online'

/** Face-to-face: weekdays only, 7:00 AM - 5:00 PM. Online: any day, 8:00 AM - 11:00 PM. */
const WINDOWS: Record<InterviewMode, { startMinute: number; endMinute: number; weekends: boolean; label: string }> = {
  in_person: { startMinute: 7 * 60, endMinute: 17 * 60, weekends: false, label: '7:00 AM and 5:00 PM' },
  online: { startMinute: 8 * 60, endMinute: 23 * 60, weekends: true, label: '8:00 AM and 11:00 PM' },
}

export const windowFor = (mode: InterviewMode) => WINDOWS[mode]

/** The calendar parts of an instant, as they read in Manila. */
function manilaParts(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(at)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // 'hour' can come back as '24' at midnight in some engines.
  const hour = Number(get('hour')) % 24

  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
    weekday: get('weekday'),
  }
}

/** Today in Manila as `YYYY-MM-DD`, for a date input's `min`. */
export const manilaToday = () => manilaParts(new Date()).ymd

/** Minutes past midnight, right now in Manila. */
export const manilaNowMinutes = () => manilaParts(new Date()).minutes

/** True when `ymd` (YYYY-MM-DD) falls on a Saturday or Sunday. */
export function isWeekendYMD(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 || day === 6
}

/** Every slot the window allows, at `stepMinutes` intervals, that fits `durationMinutes`. */
export function slotsFor(mode: InterviewMode, durationMinutes: number, stepMinutes = 30): number[] {
  const { startMinute, endMinute } = WINDOWS[mode]
  const slots: number[] = []
  for (let m = startMinute; m + durationMinutes <= endMinute; m += stepMinutes) slots.push(m)
  return slots
}

/** "7:00 AM" for a minutes-past-midnight value. */
export function minutesToLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60)
  const mm = String(minutes % 60).padStart(2, '0')
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${suffix}`
}

/** "HH:MM" for sending to the API. */
export const minutesToHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Why this slot can't be booked, or null when it's fine. Messages match the
 * backend's word for word so the two never contradict each other.
 */
export function slotViolation(
  ymd: string,
  startMinute: number | null,
  mode: InterviewMode,
  durationMinutes: number
): string | null {
  if (!ymd) return null

  const { startMinute: open, endMinute: close, weekends, label } = WINDOWS[mode]

  if (!weekends && isWeekendYMD(ymd)) {
    return 'Face-to-face interviews run Monday to Friday only. Pick a weekday, or switch to Online.'
  }

  if (ymd < manilaToday()) {
    return 'The interview cannot be scheduled in the past. Pick a later date or time.'
  }

  if (startMinute === null) return null

  if (ymd === manilaToday() && startMinute <= manilaNowMinutes()) {
    return 'The interview cannot be scheduled in the past. Pick a later date or time.'
  }

  if (startMinute < open || startMinute + durationMinutes > close) {
    const kind = mode === 'online' ? 'Online' : 'Face-to-face'
    return `${kind} interviews must start and end between ${label}.`
  }

  return null
}

/**
 * The exact instant a Manila-local date and time refers to, as an ISO string.
 * Built by measuring Manila's offset on that date rather than assuming +08:00.
 */
export function manilaToISO(ymd: string, startMinute: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const hh = Math.floor(startMinute / 60)
  const mm = startMinute % 60
  // Start from the naive UTC reading, then subtract Manila's offset at that moment.
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm)
  const offsetMs = manilaOffsetMs(new Date(naiveUtc))
  return new Date(naiveUtc - offsetMs).toISOString()
}

/** Manila's UTC offset, in milliseconds, at a given instant. */
function manilaOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - at.getTime()
}
