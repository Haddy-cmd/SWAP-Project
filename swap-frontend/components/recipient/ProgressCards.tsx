'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Clock3, XCircle, Gauge, ListChecks, ChevronRight, BarChart3 } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDate } from '@/lib/utils/formatDate'
import { formatHours } from '@/lib/utils/formatHours'
import type { RecipientProgress } from '@/types/attendance.types'

const CARD = 'rounded-2xl border border-ink-900/10 bg-white/90 px-6 pb-6 pt-[22px] shadow-[0_2px_8px_rgba(19,36,26,0.04)]'

/** One query shared by the dashboard and Hours cards (GET /recipient/progress). */
function useProgress() {
  return useQuery({ queryKey: ['recipient-progress'], queryFn: () => attendanceApi.getProgress() })
}

const PACE: Record<RecipientProgress['pace']['status'], { label: string; cls: string }> = {
  on_track: { label: 'On track', cls: 'bg-success-50 text-success-800' },
  complete: { label: 'Complete', cls: 'bg-success-50 text-success-800' },
  behind: { label: 'Behind pace', cls: 'bg-warning-50 text-warning-800' },
  not_started: { label: 'Not started', cls: 'bg-ink-100 text-ink-600' },
}

/** Dashboard: on track or behind, what each week needs, and where the current pace ends up. */
/** `bare`: no outer card (the dashboard wraps it in its own). */
export function PaceForecastCard({ bare = false }: { bare?: boolean }) {
  const { data } = useProgress()
  if (!data) return null
  const { pace, forecast: f } = data
  const badge = PACE[pace.status]

  return (
    <section className={bare ? '' : CARD}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900"><Gauge className="h-[18px] w-[18px] text-brand-600" /> Pace &amp; Forecast</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
      </div>

      {f.outstanding_hours <= 0 ? (
        <p className="text-sm text-ink-700">Your required hours are covered{data.breakdown.pending_hours > 0 ? ' once your pending hours are verified' : ''}.</p>
      ) : (
        <ul className="space-y-3 text-sm text-ink-700">
          {pace.status === 'behind' && pace.deficit_hours != null && (
            <li>You&apos;re <b className="text-warning-700">{formatHours(pace.deficit_hours)}</b> behind where the calendar expects you to be.</li>
          )}
          {f.hours_per_week_needed != null && data.end_date ? (
            <li>You need about <b className="text-ink-950">{f.hours_per_week_needed} h/week</b> to finish {formatHours(f.outstanding_hours)} by {formatDate(data.end_date)} ({f.weeks_left} weeks left).</li>
          ) : data.end_date ? (
            <li>The term ended on {formatDate(data.end_date)} with {formatHours(f.outstanding_hours)} still to go.</li>
          ) : null}
          <li>
            {f.projected_finish ? (
              <>At your recent pace ({f.recent_weekly_average} h/week) you&apos;ll finish around{' '}
                <b className={f.on_time === false ? 'text-danger-700' : 'text-success-700'}>{formatDate(f.projected_finish)}</b>
                {f.on_time === false ? ' — after the term ends.' : '.'}</>
            ) : (
              <>You haven&apos;t rendered hours in the last 4 weeks — clock in to get a forecast.</>
            )}
          </li>
        </ul>
      )}
    </section>
  )
}

const STATE = {
  done: { Icon: CheckCircle2, cls: 'text-success-600' },
  todo: { Icon: Circle, cls: 'text-danger-600' },
  waiting: { Icon: Clock3, cls: 'text-warning-600' },
  blocked: { Icon: XCircle, cls: 'text-danger-700' },
} as const

/** Dashboard: what the stipend and the renewal still need, linking to where each is done. */
export function PayoutChecklistCard({ bare = false }: { bare?: boolean }) {
  const { data } = useProgress()
  if (!data) return null
  const left = data.checklist.filter((i) => i.state !== 'done').length

  return (
    <section className={bare ? '' : CARD}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900"><ListChecks className="h-[18px] w-[18px] text-brand-600" /> Stipend &amp; Renewal Checklist</h2>
        <span className="text-xs text-ink-500">{left === 0 ? 'All done' : `${left} left`}</span>
      </div>
      <ul className="divide-y divide-ink-100">
        {data.checklist.map((item) => {
          const { Icon, cls } = STATE[item.state]
          const body = (
            <>
              <Icon className={`h-[18px] w-[18px] flex-none ${cls}`} />
              <span className={`flex-1 text-[13px] ${item.state === 'done' ? 'text-ink-600' : 'font-semibold text-ink-900'}`}>{item.label}</span>
              {item.link && item.state !== 'done' && <ChevronRight className="h-4 w-4 flex-none text-ink-300" />}
            </>
          )
          return (
            <li key={item.key}>
              {item.link && item.state !== 'done' ? (
                <Link href={item.link} className="flex items-center gap-3 py-2.5 hover:bg-ink-50/70">{body}</Link>
              ) : (
                <div className="flex items-center gap-3 py-2.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Hours page: verified / pending / rejected, days on duty, average session, bonus hours, and why logs were rejected. */
export function HoursBreakdownCard() {
  const { data } = useProgress()
  if (!data) return null
  const b = data.breakdown
  const tiles: [string, string][] = [
    ['Verified', formatHours(b.verified_hours)],
    ['Pending', formatHours(b.pending_hours)],
    ['Rejected', formatHours(b.rejected_hours)],
    ['Bonus hours', formatHours(b.bonus_hours)],
    ['Days on duty', String(b.days_on_duty)],
    ['Avg session', b.avg_session_hours == null ? '—' : formatHours(b.avg_session_hours)],
  ]

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-ink-900"><BarChart3 className="h-4 w-4 text-brand-700" /> Breakdown · {data.term}</h2>
      <p className="mb-4 text-sm text-ink-500">Bonus hours are granted by your supervisor; rejected hours don&apos;t count.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-ink-950">{value}</div>
          </div>
        ))}
      </div>
      {b.rejected_logs.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">Rejected logs</p>
          <ul className="space-y-1.5">
            {b.rejected_logs.map((l) => (
              <li key={l.id} className="rounded-lg bg-danger-50 px-3 py-2 text-[12.5px] text-danger-800">
                <b>{formatDate(l.date)}</b> · {formatHours(l.hours)} — {l.reason || 'No reason given'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
