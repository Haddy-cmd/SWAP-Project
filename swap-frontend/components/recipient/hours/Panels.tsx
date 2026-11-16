'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, UserRound, CalendarDays, CalendarRange, TrendingUp, FilePen, History, Clock, XCircle, Hourglass, Timer, X } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatDate'
import { TermBadge } from '@/components/shared/TermBadge'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import type { HoursSummary, RecipientProgress, TimeLog } from '@/types/attendance.types'
import type { Assignment, TermHistoryItem } from '@/types/assignment.types'
import { CountUp } from '@/components/ui/CountUp'
import { CARD, LOG_STATUS, fmtClock, fmtDur, fmtH, localDay, manilaToday } from './ui'

// ── Weeks ───────────────────────────────────────────────────────────────────

const mondayOf = (d: Date) => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); x.setHours(0, 0, 0, 0); return x }
const shortDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const round1 = (h: number) => Math.round(h * 10) / 10

export type Week = { key: string; monday: Date; v: number; p: number; total: number; current: boolean }

/** Verified and waiting hours per week of the term (the last 12 weeks), this week included. */
export function useWeeks(logs: TimeLog[]): Week[] {
  return useMemo(() => {
    const map = new Map<string, { v: number; p: number; monday: Date }>()
    for (const l of logs) {
      if (!l.date || l.duration_hours == null) continue
      const monday = mondayOf(new Date(l.date.slice(0, 10) + 'T00:00:00'))
      const key = localDay(monday)
      const b = map.get(key) ?? { v: 0, p: 0, monday }
      if (l.status === 'verified') b.v += Number(l.duration_hours) || 0
      else if (l.status === 'pending_verification') b.p += Number(l.duration_hours) || 0
      map.set(key, b)
    }
    const thisWeek = localDay(mondayOf(new Date()))
    if (!map.has(thisWeek) && map.size) map.set(thisWeek, { v: 0, p: 0, monday: mondayOf(new Date()) })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([key, w]) => ({ key, ...w, total: w.v + w.p, current: key === thisWeek }))
  }, [logs])
}

const bestOf = (weeks: Week[]) => weeks.reduce<Week | null>((b, w) => (w.total > 0 && (!b || w.total > b.total) ? w : b), null)

// ── Your hours ──────────────────────────────────────────────────────────────

/** Where the term stands: the bar (verified + waiting), what's left, and four quick facts. */
export function YourHours({ summary, progress, assignment, endDate, weeks }: {
  summary: HoursSummary | undefined
  progress: RecipientProgress | null | undefined
  assignment: Assignment | null | undefined
  endDate: string | null | undefined
  weeks: Week[]
}) {
  const req = summary?.required ?? 0
  const v = summary?.verified ?? 0
  const p = summary?.pending ?? 0
  const left = Math.max(0, req - v)
  const pctV = req > 0 ? Math.min(100, (v / req) * 100) : 0
  const pctP = req > 0 ? Math.min(100 - pctV, (p / req) * 100) : 0
  const ended = !!endDate && endDate < manilaToday()
  const weeksLeft = progress?.forecast.weeks_left
  const days = progress?.breakdown.days_on_duty ?? 0
  const best = bestOf(weeks)

  const facts = [
    { Icon: UserRound, k: 'Supervisor', v: assignment?.supervisor?.name ?? '—', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' },
    {
      Icon: CalendarDays, k: ended ? 'Term ended' : 'Term ends', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)',
      v: endDate ? `${formatDate(endDate)}${!ended && weeksLeft != null ? ` · ${weeksLeft} ${weeksLeft === 1 ? 'week' : 'weeks'} left` : ''}` : '—',
    },
    { Icon: CalendarRange, k: 'Days on duty', v: `${days} ${days === 1 ? 'day' : 'days'}`, fg: 'var(--text-violet-600)', bg: 'var(--color-violet-100)' },
    { Icon: TrendingUp, k: 'Best week', v: best ? `${fmtH(round1(best.total))}h · ${shortDay(best.monday)}` : '—', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  ]

  return (
    <div className={`${CARD} flex flex-col gap-[18px] p-[22px]`}>
      <div>
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[15px] font-bold text-ink-950">Your hours</span>
          <span className="whitespace-nowrap text-[13px] text-ink-500"><CountUp value={round1(v)} format={(n) => `${fmtH(round1(n))}h`} className="text-[20px] font-bold text-ink-950" /> of {req}h</span>
        </div>
        <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-surface-3">
          <div className="bar-grow-x bg-accent" style={{ width: `${pctV}%` }} />
          <div className="bar-grow-x bg-gold-accent" style={{ width: `${pctP}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /><b className="text-ink-900">{fmtH(round1(v))}h</b> verified</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold-accent" /><b className="text-ink-900">{fmtH(round1(p))}h</b> waiting</span>
          <span className="text-ink-500"><b className="text-ink-900">{fmtH(round1(left))}h</b> to go</span>
        </div>
      </div>
      <div className="h-px bg-ink-900/[.06]" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.k} className="flex min-w-0 gap-2.5">
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px]" style={{ background: f.bg, color: f.fg }}><f.Icon className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11.5px] leading-snug text-ink-500">{f.k}</p>
              <p className="mt-0.5 text-[13.5px] font-bold leading-snug text-ink-950">{f.v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hours per week (modal) ──────────────────────────────────────────────────

/** Verified and waiting hours per week, with the weekly goal that finishes the term on time. */
export function WeeklyModal({ weeks, progress, onClose }: { weeks: Week[]; progress: RecipientProgress | null | undefined; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const need = progress?.forecast.hours_per_week_needed
  const target = need && need > 0 ? Math.ceil(need) : 0
  const max = Math.max(1, target, ...weeks.map((w) => w.total)) * 1.12
  const best = bestOf(weeks)
  const thisWeek = weeks.find((w) => w.current)
  const past = weeks.filter((w) => !w.current)
  const avg = past.length ? past.reduce((s, w) => s + w.v, 0) / past.length : 0
  const stats = [
    { k: 'This week', v: `${fmtH(round1(thisWeek?.total ?? 0))}h` },
    { k: 'Weekly average', v: `${fmtH(round1(avg))}h` },
    { k: 'Best week', v: best ? `${fmtH(round1(best.total))}h` : '—' },
  ]

  return (
    <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/35 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Hours per week" onClick={(e) => e.stopPropagation()}
        className="animate-panel-in flex w-full max-w-[720px] flex-col gap-[18px] rounded-[22px] bg-surface p-6 shadow-[0_30px_70px_rgba(0,0,0,.25)]">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[19px] font-extrabold text-ink-950">Hours per week</p>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {weeks.length ? `Last ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}` : 'Your weeks show here once you log hours.'}
              {target > 0 && ` · aim for about ${target}h a week to finish on time`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-surface-3 text-ink-700 hover:bg-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="stagger grid grid-cols-3 gap-1.5 sm:gap-2.5">
          {stats.map((s) => (
            <div key={s.k} className="rounded-[14px] bg-surface-2 px-3.5 py-3">
              <p className="text-[12px] text-ink-500">{s.k}</p>
              <p className="mt-0.5 text-[20px] font-extrabold text-ink-950">{s.v}</p>
            </div>
          ))}
        </div>

        {weeks.length > 0 && (
          <div>
            <div className="relative flex h-[210px] items-end gap-2 border-b border-ink-200 px-1 sm:gap-2.5">
              {target > 0 && (
                <div className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-gold-accent" style={{ bottom: `${(target / max) * 100}%` }}>
                  <span className="absolute -top-5 right-0 text-[11px] font-bold text-gold-700">{target}h goal</span>
                </div>
              )}
              {weeks.map((w) => (
                <div key={w.key} className="flex h-full flex-1 flex-col items-center justify-end"
                  title={`Week of ${shortDay(w.monday)}: ${fmtDur(w.v)} verified, ${fmtDur(w.p)} waiting`}>
                  {w.total > 0 && <span className="mb-1 text-[11.5px] font-bold text-ink-700">{fmtH(round1(w.total))}h</span>}
                  <div className="flex w-full max-w-[46px] flex-col overflow-hidden rounded-[8px_8px_3px_3px]">
                    {w.p > 0 && <div className="bar-grow-y bg-gold-accent" style={{ height: `${(w.p / max) * 180}px` }} />}
                    {w.v > 0 && <div className={`bar-grow-y ${target > 0 && w.v < target ? 'bg-accent-bright' : 'bg-accent'}`} style={{ height: `${(w.v / max) * 180}px` }} />}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 px-1 sm:gap-2.5">
              {weeks.map((w) => (
                <span key={w.key} className={`flex-1 truncate text-center text-[11.5px] max-sm:[&:nth-child(even)]:invisible ${w.current ? 'font-extrabold text-ink-950' : 'text-ink-500'}`}>
                  {w.current ? 'This week' : shortDay(w.monday)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />Verified</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-gold-accent" />Waiting for supervisor</span>
        </div>
      </div>
    </div>
  )
}

// ── Time logs ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'verified' | 'pending_verification' | 'rejected'
const FILTERS: [Filter, string][] = [['all', 'All'], ['verified', 'Verified'], ['pending_verification', 'Waiting'], ['rejected', 'Rejected']]
const STATUS_ICON = { verified: Check, pending_verification: Hourglass, rejected: XCircle, open: Timer } as const

/** Every log of the term grouped by day, filterable, with "Add what you did" for logs missing a task. */
export function TimeLogList({ logs, loading, hasMore, onMore, loadingMore }: {
  logs: TimeLog[]; loading: boolean; hasMore: boolean; onMore: () => void; loadingMore: boolean
}) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [taskFor, setTaskFor] = useState<number | null>(null)
  const closed = logs.filter((l) => l.status !== 'open')
  const count = (f: Filter) => (f === 'all' ? closed.length : closed.filter((l) => l.status === f).length)
  const shown = closed.filter((l) => filter === 'all' || l.status === filter)

  // Newest day first (the API already sorts by date, then time).
  const today = localDay()
  const days: { key: string; label: string; total: number; items: TimeLog[] }[] = []
  for (const l of shown) {
    const key = l.date.slice(0, 10)
    let g = days.find((d) => d.key === key)
    if (!g) {
      const label = new Date(key + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
      days.push(g = { key, label: key === today ? `TODAY · ${label}` : label, total: 0, items: [] })
    }
    g.items.push(l)
    if (l.status !== 'rejected') g.total += Number(l.duration_hours) || 0
  }

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/[.06] px-[22px] py-4">
        <p className="text-[16px] font-bold text-ink-950">Time logs</p>
        <div className="flex gap-0.5 overflow-x-auto rounded-[11px] bg-ink-100 p-[3px]" role="tablist" aria-label="Filter logs">
          {FILTERS.map(([key, label]) => {
            const on = filter === key
            return (
              <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setFilter(key)}
                className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12.5px] font-semibold ${
                  on ? 'bg-surface text-ink-950 shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-500 hover:text-ink-800'}`}>
                {label}<span className="text-[11px] font-bold opacity-60">{count(key)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-100" />)}</div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-surface-3 text-ink-400"><Clock className="h-6 w-6" /></span>
          <p className="text-[14px] font-semibold text-ink-800">No logs here</p>
          <p className="text-[12.5px] text-ink-500">Clock in and out on each service day.</p>
        </div>
      ) : days.map((d) => (
        <div key={d.key}>
          <div className="flex justify-between bg-surface-2 px-[22px] py-2.5 text-[12px] font-bold tracking-[0.04em] text-ink-500">
            <span>{d.label}</span><span>{fmtDur(d.total)}</span>
          </div>
          {d.items.map((l) => {
            const meta = LOG_STATUS[l.status] ?? LOG_STATUS.pending_verification
            const Icon = STATUS_ICON[l.status] ?? Hourglass
            const task = l.narrative_report?.content?.trim()
            const needsTask = !l.has_narrative && !l.is_manual && l.status !== 'rejected'
            return (
              // Phones: two lines (time · task on the left, hours and status stacked on the right).
              <div key={l.id} className="flex items-start gap-3 border-b border-ink-900/[.04] px-4 py-3.5 last:border-0 sm:items-center sm:gap-3.5 sm:px-[22px]">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]" style={{ background: meta.bg, color: meta.fg }}>
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold tabular-nums text-ink-950">
                    {l.is_manual ? 'Bonus hours' : `${fmtClock(l.time_in)} – ${fmtClock(l.time_out)}`}
                    {l.is_manual && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">Bonus</span>}
                    {l.clocked_out_reason && l.clocked_out_reason !== 'manual' && (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-700" title="You didn't clock out, so the system did it for you">Auto clock-out</span>
                    )}
                  </p>
                  <p className={`mt-0.5 line-clamp-2 text-[12.5px] ${task || l.is_manual ? 'text-ink-500' : 'text-ink-400'}`}>
                    {l.is_manual ? (l.manual_reason || 'Added by your supervisor') : task || 'No task description yet'}
                  </p>
                  {l.status === 'rejected' && <p className="mt-0.5 text-xs text-red-strong">{l.rejection_reason || 'Rejected by your supervisor'}</p>}
                  {needsTask && (
                    <button type="button" onClick={() => setTaskFor(l.id)}
                      className="mt-2 flex h-9 items-center gap-1.5 rounded-[10px] border border-dashed border-accent/40 bg-accent-tint px-3 text-[12.5px] font-semibold text-accent-strong hover:border-accent sm:hidden">
                      <FilePen className="h-4 w-4" /> Add what you did
                    </button>
                  )}
                </div>
                {needsTask && (
                  <button type="button" onClick={() => setTaskFor(l.id)}
                    className="hidden h-[34px] items-center gap-1.5 rounded-[10px] border border-dashed border-accent/40 bg-accent-tint px-3 text-[12.5px] font-semibold text-accent-strong hover:border-accent sm:flex">
                    <FilePen className="h-4 w-4" /> Add what you did
                  </button>
                )}
                <div className="flex flex-none flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3.5">
                  <span className="text-right text-[14px] font-extrabold text-ink-950 sm:min-w-[52px]">{fmtDur(l.duration_hours)}</span>
                  <span className="rounded-full px-2.5 py-1 text-center text-[11.5px] font-bold sm:min-w-[78px]" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {hasMore && (
        <button onClick={onMore} disabled={loadingMore} className="w-full border-t border-ink-900/[.06] py-3 text-[13px] font-semibold text-accent hover:bg-surface-2 disabled:opacity-60">
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      {taskFor != null && (
        <NarrativeModal logId={taskFor} pastLog onClose={() => setTaskFor(null)}
          onSubmitted={() => { setTaskFor(null); queryClient.invalidateQueries({ queryKey: ['my-logs'] }) }} />
      )}
    </div>
  )
}

// ── Past terms ──────────────────────────────────────────────────────────────

// A release is final; claimed/certified/pending are legacy stubs from before 2026-10-05.
const STIPEND: Record<string, string> = {
  released: 'Stipend released', claimed: 'Stipend received', certified: 'Stipend released', pending: 'Stipend released', void: 'Stipend stub voided',
}

export function PastTerms({ terms }: { terms: TermHistoryItem[] }) {
  if (!terms.length) return null
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="border-b border-ink-900/[.05] px-[22px] py-4">
        <p className="text-[15px] font-bold text-ink-950">Past terms</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">Hours stay with their term and don&apos;t carry over.</p>
      </div>
      {terms.map((t) => (
        <div key={t.assignment_id} className="flex flex-wrap items-center gap-3.5 border-b border-ink-900/[.04] px-[22px] py-3.5 last:border-0">
          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-accent-soft text-accent-strong"><History className="h-[19px] w-[19px]" /></span>
          <div className="min-w-[200px] flex-1">
            <p className="text-[14px] font-bold text-ink-950">{t.semester} {t.academic_year}</p>
            <p className="mt-px text-[12.5px] text-ink-500">{t.office ?? '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-[13.5px] font-bold text-ink-950">{fmtH(t.verified_hours)}h of {t.required_hours}h</p>
            <p className="text-xs text-ink-500">
              {t.stipend_status ? STIPEND[t.stipend_status] ?? t.stipend_status : 'No stipend yet'}
              {t.stipend_amount != null && t.stipend_status !== 'void' ? ` · ₱${t.stipend_amount.toLocaleString('en-PH')}` : ''}
              {t.stipend_released_at ? ` · ${formatDate(t.stipend_released_at)}` : ''}
            </p>
          </div>
          <TermBadge badge={t.term_badge} deficientHours={t.deficient_hours} />
        </div>
      ))}
    </div>
  )
}
