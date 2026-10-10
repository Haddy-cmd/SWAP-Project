'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Timer, Check, Moon, Building2, UserRound, CalendarDays, CalendarRange, FileText, History, Clock, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatDate'
import { TermBadge } from '@/components/shared/TermBadge'
import type { HoursSummary, RecipientProgress, TimeLog } from '@/types/attendance.types'
import type { Assignment, TermHistoryItem } from '@/types/assignment.types'
import { CARD, LOG_STATUS, fmtClock, fmtDur, fmtH, localDay } from './ui'

// ── Progress hero ───────────────────────────────────────────────────────────

/** The term at a glance: ring, what's left and what it takes per week, and the hour breakdown. */
export function ProgressHero({ summary, progress, endDate }: {
  summary: HoursSummary | undefined
  progress: RecipientProgress | null | undefined
  endDate: string | null | undefined
}) {
  const req = summary?.required ?? 0
  const v = summary?.verified ?? 0
  const p = summary?.pending ?? 0
  const rejected = progress?.breakdown.rejected_hours ?? summary?.rejected ?? 0
  const bonus = progress?.breakdown.bonus_hours ?? 0
  const left = Math.max(0, req - v)
  const pctV = req > 0 ? Math.min(100, (v / req) * 100) : 0
  const pctP = req > 0 ? Math.min(100 - pctV, (p / req) * 100) : 0
  const perWeek = progress?.forecast.hours_per_week_needed
  const end = endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

  const text = left > 0
    ? `${fmtH(v)}h of ${req}h verified.${perWeek && perWeek > 0 ? ` About ${Math.ceil(perWeek)}h a week gets you there${end ? ` by ${end}` : ''}.` : p > 0 ? ` ${fmtH(p)}h is waiting for your supervisor.` : ''}`
    : 'Submit your end-of-term report so your stipend can be released.'

  return (
    <div className="relative flex flex-wrap items-center gap-7 overflow-hidden rounded-[20px] px-7 py-[26px] text-white" style={{ background: 'var(--hero-gradient)' }}>
      <div className="relative h-[150px] w-[150px] flex-none rounded-full"
        style={{ background: `conic-gradient(#2FA57C 0 ${pctV}%, #DDBB38 ${pctV}% ${pctV + pctP}%, rgba(255,255,255,.14) ${pctV + pctP}% 100%)` }}>
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[#063D27]">
          <span className="text-[32px] font-extrabold leading-none">{Math.round(pctV)}%</span>
          <span className="mt-1 text-[11.5px] text-white/70">verified</span>
        </div>
      </div>
      <div className="min-w-[240px] flex-1">
        <p className="text-[11.5px] font-extrabold tracking-[0.14em] text-[#DDBB38]">{left > 0 ? 'KEEP GOING' : 'ALL DONE'}</p>
        <p className="mt-1 text-[30px] font-extrabold leading-tight">{left > 0 ? `${fmtH(left)} hours to go` : 'You finished your hours'}</p>
        <p className="mt-1.5 text-[13.5px] text-white/80">{text}</p>
        <div className="mt-[18px] flex h-2.5 overflow-hidden rounded-md bg-white/[.14]">
          <div style={{ width: `${pctV}%`, background: '#2FA57C' }} />
          <div style={{ width: `${pctP}%`, background: '#DDBB38' }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/85">
          {[
            ['#2FA57C', `${fmtH(v)}h`, 'verified'],
            ['#DDBB38', `${fmtH(p)}h`, 'waiting'],
            ['#E07A72', `${fmtH(rejected)}h`, "rejected (doesn't count)"],
            ['#FFFFFF', `${fmtH(bonus)}h`, 'bonus (included)'],
          ].map(([color, value, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: color }} />
              <strong className="text-white">{value}</strong>{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Today + this term ───────────────────────────────────────────────────────

export function TodaySessions({ logs }: { logs: TimeLog[] }) {
  const today = localDay()
  const sessions = logs.filter((l) => l.date?.slice(0, 10) === today)
  const total = sessions.reduce((s, l) => s + (l.time_out ? Number(l.duration_hours) || 0 : (Date.now() - new Date(l.time_in).getTime()) / 3600000), 0)

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-ink-900/[.05] px-5 py-4">
        <span className="text-[14.5px] font-bold text-ink-950">Today&apos;s sessions</span>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-strong">{fmtDur(total)} today</span>
      </div>
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
          <Moon className="h-8 w-8 text-ink-350" />
          <p className="text-[13.5px] font-semibold text-ink-800">No sessions yet today</p>
          <p className="text-[12.5px] text-ink-500">Clock in when you arrive at your office.</p>
        </div>
      ) : sessions.map((s) => {
        const meta = LOG_STATUS[s.status] ?? LOG_STATUS.pending_verification
        const open = !s.time_out
        return (
          <div key={s.id} className="flex items-center gap-3 border-b border-ink-900/[.04] px-5 py-3 last:border-0">
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px]" style={{ background: meta.bg, color: meta.fg }}>
              {open ? <Timer className="h-[18px] w-[18px]" /> : s.status === 'rejected' ? <XCircle className="h-[18px] w-[18px]" /> : <Check className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold tabular-nums text-ink-950">{fmtClock(s.time_in)} – {open ? 'now' : fmtClock(s.time_out)}</p>
              <p className="text-xs text-ink-500">{open ? 'In progress' : s.status === 'pending_verification' ? 'Waiting for supervisor' : meta.label}</p>
            </div>
            <strong className="text-[13.5px] text-ink-950">{open ? '…' : fmtDur(s.duration_hours)}</strong>
          </div>
        )
      })}
    </div>
  )
}

export function ThisTerm({ assignment, progress }: { assignment: Assignment | null | undefined; progress: RecipientProgress | null | undefined }) {
  const end = assignment?.effective_end_date ?? progress?.end_date ?? null
  const weeks = progress?.forecast.weeks_left
  const days = progress?.breakdown.days_on_duty ?? 0
  const avg = progress?.breakdown.avg_session_hours
  const facts = [
    { Icon: Building2, k: 'Office', v: assignment?.office?.name ?? '—', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
    { Icon: UserRound, k: 'Supervisor', v: assignment?.supervisor?.name ?? '—', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' },
    { Icon: CalendarDays, k: 'Term ends', v: end ? `${formatDate(end)}${weeks != null ? ` · ${weeks} ${weeks === 1 ? 'week' : 'weeks'} left` : ''}` : '—', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)' },
    { Icon: CalendarRange, k: 'Days on duty', v: `${days} ${days === 1 ? 'day' : 'days'}${avg ? ` · avg ${fmtDur(avg)} a session` : ''}`, fg: 'var(--text-violet-600)', bg: 'var(--color-violet-100)' },
  ]
  return (
    <div className={`${CARD} flex flex-col gap-3 px-[22px] py-5`}>
      <p className="text-[14.5px] font-bold text-ink-950">This term</p>
      {facts.map((f) => (
        <div key={f.k} className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: f.bg, color: f.fg }}><f.Icon className="h-[19px] w-[19px]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-ink-500">{f.k}</p>
            <p className="truncate text-[13.5px] font-bold text-ink-950">{f.v}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Hours per week ──────────────────────────────────────────────────────────

const mondayOf = (d: Date) => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); x.setHours(0, 0, 0, 0); return x }

/** Verified and waiting hours per week of the term (up to the last 12 weeks), this week highlighted. */
export function WeeklyBars({ logs }: { logs: TimeLog[] }) {
  const weeks = useMemo(() => {
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

  const max = Math.max(1, ...weeks.map((w) => w.total))
  const best = Math.max(0, ...weeks.map((w) => w.total))

  return (
    <div className={`${CARD} px-[22px] py-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-ink-950">Hours per week</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">{weeks.length ? `Your best week was ${fmtH(Math.round(best * 10) / 10)}h · last ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}` : 'Your weeks show here once you log hours.'}</p>
        </div>
        <div className="flex gap-3.5 text-xs text-ink-600">
          <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-[3px] bg-accent" />Verified</span>
          <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-[3px] bg-gold-accent" />Waiting</span>
        </div>
      </div>
      {weeks.length > 0 && (
        <>
          <div className="mt-[18px] flex h-[170px] items-end gap-2 border-b border-ink-200 sm:gap-3.5"
            style={{ backgroundImage: 'linear-gradient(var(--color-surface-3) 1px, transparent 1px)', backgroundSize: '100% 25%' }}>
            {weeks.map((w) => (
              <div key={w.key} className="flex h-full flex-1 flex-col items-center justify-end" title={`Week of ${w.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${fmtDur(w.v)} verified, ${fmtDur(w.p)} waiting`}>
                {w.total > 0 && <span className="mb-1 text-[11.5px] font-bold text-ink-700">{fmtH(Math.round(w.total * 10) / 10)}h</span>}
                {w.p > 0 && <div className="w-full max-w-[34px] bg-gold-accent" style={{ height: `${(w.p / max) * 80}%`, borderRadius: '7px 7px 0 0' }} />}
                {w.v > 0 && <div className="w-full max-w-[34px]" style={{ height: `${(w.v / max) * 80}%`, background: 'linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))', borderRadius: w.p > 0 ? 0 : '7px 7px 0 0' }} />}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-3.5">
            {weeks.map((w) => (
              <span key={w.key} className={`flex-1 truncate text-center text-[11.5px] ${w.current ? 'font-bold text-ink-950' : 'text-ink-500'}`}>
                {w.current ? 'This week' : w.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Time logs ───────────────────────────────────────────────────────────────

type Chip = 'all' | 'verified' | 'pending_verification' | 'rejected'
const CHIPS: [Chip, string][] = [['all', 'All'], ['verified', 'Verified'], ['pending_verification', 'Waiting'], ['rejected', 'Rejected']]

/** Every log of the term, filterable, with the task-description shortcut for logs still missing one. */
export function TimeLogList({ logs, loading, hasMore, onMore, loadingMore }: {
  logs: TimeLog[]; loading: boolean; hasMore: boolean; onMore: () => void; loadingMore: boolean
}) {
  const [chip, setChip] = useState<Chip>('all')
  const closed = logs.filter((l) => l.status !== 'open')
  const count = (c: Chip) => (c === 'all' ? closed.length : closed.filter((l) => l.status === c).length)
  const shown = closed.filter((l) => chip === 'all' || l.status === chip)

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-900/[.05] px-[22px] py-4">
        <p className="min-w-[160px] flex-1 text-[15px] font-bold text-ink-950">Time logs</p>
        {CHIPS.map(([key, label]) => {
          const on = chip === key
          return (
            <button key={key} onClick={() => setChip(key)} aria-pressed={on}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold ${on ? 'border-accent-deep bg-accent-deep text-white' : 'border-ink-200 bg-surface text-ink-700'}`}>
              {label}<span className="font-extrabold">{count(key)}</span>
            </button>
          )
        })}
      </div>
      {loading ? (
        <div className="space-y-2 p-4">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-100" />)}</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-9 text-center">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-surface-3 text-ink-400"><Clock className="h-6 w-6" /></span>
          <p className="text-[14px] font-semibold text-ink-800">No logs here</p>
          <p className="text-[12.5px] text-ink-500">Use Clock in / out on each service day.</p>
        </div>
      ) : shown.map((l) => {
        const meta = LOG_STATUS[l.status] ?? LOG_STATUS.pending_verification
        const d = new Date(l.date.slice(0, 10) + 'T00:00:00')
        const needsTask = !l.has_narrative && !l.is_manual && l.status !== 'rejected'
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-3.5 border-b border-ink-900/[.04] px-[22px] py-3 last:border-0">
            <div className="w-[46px] flex-none text-center leading-tight">
              <p className="text-[11px] font-bold uppercase text-ink-500">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
              <p className="text-[20px] font-extrabold text-ink-950">{d.getDate()}</p>
            </div>
            <div className="min-w-[180px] flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold tabular-nums text-ink-950">
                {l.is_manual ? 'Bonus hours' : `${fmtClock(l.time_in)} – ${fmtClock(l.time_out)}`}
                {l.is_manual && <span className="rounded-md bg-violet-100 px-1.5 py-px text-[10.5px] font-bold text-violet-700">Bonus</span>}
                {l.clocked_out_reason && l.clocked_out_reason !== 'manual' && <span className="rounded-md bg-surface-3 px-1.5 py-px text-[10.5px] font-bold text-ink-600">Auto clock-out</span>}
              </p>
              <p className="mt-px text-xs text-ink-500">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}{l.office?.name ? ` · ${l.office.name}` : ''}{l.is_manual && l.manual_reason ? ` · ${l.manual_reason}` : ''}
              </p>
              {l.status === 'rejected' && <p className="mt-0.5 text-xs text-red-strong">{l.rejection_reason || 'Rejected by your supervisor'}</p>}
              {needsTask && (
                <Link href={`/recipient/narrative/${l.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  <FileText className="h-3.5 w-3.5" /> Add task description
                </Link>
              )}
            </div>
            <span className="min-w-[56px] flex-none text-right text-[14px] font-extrabold text-ink-950">{fmtDur(l.duration_hours)}</span>
            <span className="min-w-[92px] flex-none text-right">
              <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
            </span>
          </div>
        )
      })}
      {hasMore && (
        <button onClick={onMore} disabled={loadingMore} className="w-full py-3 text-[13px] font-semibold text-accent hover:bg-surface-2 disabled:opacity-60">
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
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
