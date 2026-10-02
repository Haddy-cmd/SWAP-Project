import type { SemesterPeriod } from '@/types/semester.types'

// Period dates are Manila calendar days (YYYY-MM-DD); format them without a timezone shift.
export function formatDay(ymd: string, month: 'short' | 'long' = 'short'): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', year: 'numeric', month, day: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, d)))
}

export function periodRange(p: Pick<SemesterPeriod, 'start_date' | 'end_date'>): string {
  return `${formatDay(p.start_date)} to ${formatDay(p.end_date)}`
}

export function daysLeftText(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'Last day today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

export const PHASE_STYLE: Record<SemesterPeriod['phase'], { label: string; className: string }> = {
  current: { label: 'Current', className: 'bg-success-50 text-success-700 border-success-200' },
  upcoming: { label: 'Upcoming', className: 'bg-brand-50 text-brand-700 border-brand-200' },
  ended: { label: 'Ended', className: 'bg-ink-100 text-ink-500 border-ink-200' },
}
