import type { TimeLog } from '@/types/attendance.types'

/** Shared look and helpers for Hours & Attendance (layout "SWAP Recipient Hours - Attendance"). */

export const CARD = 'rounded-[20px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'

export const pad = (n: number) => String(n).padStart(2, '0')

export const fmtClock = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

/** 1.5 → "1h 30m", 4 → "4h", 0.25 → "15m". */
export const fmtDur = (hours: number | null | undefined) => {
  const mins = Math.round((Number(hours) || 0) * 60)
  const h = Math.floor(mins / 60), m = mins % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

/** 96 → "96", 4.5 → "4.5". */
export const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))

/** Local YYYY-MM-DD, so "today" matches the student's wall calendar. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

/** How a log's status reads and looks (open = still clocked in). */
export const LOG_STATUS: Record<TimeLog['status'], { label: string; fg: string; bg: string }> = {
  verified: { label: 'Verified', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  pending_verification: { label: 'Waiting', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)' },
  rejected: { label: 'Rejected', fg: 'var(--text-red-strong)', bg: 'var(--color-danger-100)' },
  open: { label: 'In progress', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' },
}
