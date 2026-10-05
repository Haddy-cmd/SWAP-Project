'use client'

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Coins, Gavel, RefreshCw, ShieldAlert, UserCheck, Building2, Filter } from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import type { ProgramInsights as Insights } from '@/types/analytics.types'

const CARD = 'rounded-[15px] border border-ink-200 bg-white p-6 shadow-[0_2px_8px_rgba(19,36,26,0.04)]'

const peso = (n: number) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number | null | undefined, suffix = '') => (n == null ? '—' : `${Number(n).toLocaleString('en-PH')}${suffix}`)

function Title({ icon, children, note }: { icon: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[14px] font-bold text-ink-950">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-50 text-brand-700">{icon}</span>
        {children}
      </div>
      {note && <span className="text-xs text-ink-500">{note}</span>}
    </div>
  )
}

function Tile({ label, value, sub, tone = 'ink' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ink' | 'good' | 'bad' | 'warn' }) {
  const color = { ink: 'text-ink-950', good: 'text-success-700', bad: 'text-danger-700', warn: 'text-warning-700' }[tone]
  return (
    <div className="rounded-[12px] border border-ink-100 bg-ink-50/60 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className={`mt-1 font-serif text-[24px] font-semibold leading-none tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-500">{sub}</div>}
    </div>
  )
}

function Table({ headers, rows, empty, numeric = [] }: { headers: string[]; rows: ReactNode[][]; empty: string; numeric?: number[] }) {
  if (!rows.length) return <p className="rounded-[11px] border border-dashed border-ink-300 bg-ink-50 p-4 text-[12.5px] text-ink-600">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`whitespace-nowrap border-b-2 border-ink-200 px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-500 ${numeric.includes(i) ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`whitespace-nowrap border-b border-ink-100 px-2 py-2 text-ink-700 ${numeric.includes(ci) ? 'text-right tabular-nums' : 'text-left'} ${ci === 0 ? 'font-semibold text-ink-900' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Count that's only highlighted when it isn't zero. */
const Flag = ({ n }: { n: number }) => <span className={n > 0 ? 'font-bold text-warning-700' : 'text-ink-400'}>{n}</span>

/**
 * Admin → Analytics, below the charts: how the selected term ended, renewals, money,
 * attendance integrity, supervisor workload, the application funnel and office use
 * (GET /admin/analytics/insights).
 */
export function ProgramInsights({ academicYear, semester }: { academicYear: string; semester: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-insights', academicYear, semester],
    queryFn: () => analyticsApi.getInsights(academicYear, semester),
  })

  if (isLoading || !data) {
    return <div className="h-[420px] animate-pulse rounded-[15px] bg-ink-100" />
  }

  return <InsightsBody data={data} term={`${semester} ${academicYear}`} />
}

function InsightsBody({ data, term }: { data: Insights; term: string }) {
  const { term_results: t, renewals: r, stipend: s, funnel: f } = data

  return (
    <div className="space-y-[22px]">
      <div className="grid gap-[22px] lg:grid-cols-2">
        {/* Term results */}
        <div className={CARD}>
          <Title icon={<Gavel className="h-4 w-4" />} note={`${t.placements} placements`}>Term Results · {term}</Title>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Qualified" value={t.qualified} tone="good" />
            <Tile label="Deficient" value={t.deficient} tone={t.deficient ? 'bad' : 'ink'} sub={t.deficient_hours ? `${num(t.deficient_hours)} h short in all` : undefined} />
            <Tile label="In progress" value={t.in_progress} />
            <Tile label="Promissory notes" value={t.promissory.filed}
              sub={`${t.promissory.approved} approved · ${t.promissory.pending} pending · ${t.promissory.rejected} rejected`} />
            <Tile label="Hours carried over" value={num(t.carried_hours)} sub="Added to the next term on renewal" />
          </div>
        </div>

        {/* Renewals */}
        <div className={CARD}>
          <Title icon={<RefreshCw className="h-4 w-4" />}
            note={r.renewal_rate != null && r.previous_term ? `${r.renewal_rate}% of ${r.previous_recipients} recipients in ${r.previous_term}` : undefined}>
            Renewals
          </Title>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Submitted" value={r.submitted} />
            <Tile label="Approved" value={r.approved} tone="good" />
            <Tile label="Rejected" value={r.rejected} tone={r.rejected ? 'bad' : 'ink'} />
            <Tile label="Waiting" value={r.waiting} tone={r.waiting ? 'warn' : 'ink'} />
          </div>
          {r.waiting_reasons.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">Why waiting renewals can&apos;t be approved yet</div>
              <ul className="space-y-1.5">
                {r.waiting_reasons.map((w) => (
                  <li key={w.reason} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-[12.5px]">
                    <span className="text-ink-700">{w.reason}</span>
                    <span className="font-bold tabular-nums text-ink-900">{w.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Stipend */}
      <div className={CARD}>
        <Title icon={<Coins className="h-4 w-4" />} note={`${s.stubs} stub${s.stubs === 1 ? '' : 's'} · ${s.via_promissory} via promissory`}>Stipend Disbursement</Title>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Released" value={peso(s.released_amount)} />
          <Tile label="Claimed" value={peso(s.claimed_amount)} tone="good" sub={`${s.claimed} recipient${s.claimed === 1 ? '' : 's'}`} />
          <Tile label="Awaiting claim" value={peso(s.awaiting_amount)} tone={s.awaiting ? 'warn' : 'ink'} sub={`${s.awaiting} recipient${s.awaiting === 1 ? '' : 's'}`} />
          <Tile label="Days to claim" value={num(s.avg_days_to_claim)} sub="Average, release → claimed" />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">Ready to claim for over {s.unclaimed_after_days} days</div>
          <Table headers={['Recipient', 'Control No.', 'Amount', 'Days waiting']} numeric={[2, 3]} empty="No stub has been waiting that long."
            rows={s.unclaimed.map((u) => [u.name, u.control_number ?? '—', peso(u.amount), u.days])} />
        </div>
      </div>

      <div className="grid gap-[22px] lg:grid-cols-2">
        {/* Attendance integrity */}
        <div className={CARD}>
          <Title icon={<ShieldAlert className="h-4 w-4" />}>Attendance Integrity by Office</Title>
          <Table headers={['Office', 'Logs', 'Flagged', 'Auto clock-outs', 'Rejected', 'No task description']} numeric={[1, 2, 3, 4, 5]}
            empty="No attendance logs this term."
            rows={data.integrity.map((o) => [o.office, o.logs, <Flag key="f" n={o.flagged} />, <Flag key="a" n={o.auto_clock_outs} />, <Flag key="r" n={o.rejected} />, <Flag key="m" n={o.missing_task} />])} />
        </div>

        {/* Supervisor workload */}
        <div className={CARD}>
          <Title icon={<UserCheck className="h-4 w-4" />}>Supervisor Workload</Title>
          <Table headers={['Supervisor', 'Pending', 'Pending hrs', 'Oldest (days)', 'Verified', 'Avg verify time']} numeric={[1, 2, 3, 4, 5]}
            empty="Nothing verified or waiting this term."
            rows={data.workload.map((w) => [w.name, <Flag key="p" n={w.pending} />, num(w.pending_hours), num(w.oldest_pending_days), w.verified, w.avg_verify_hours == null ? '—' : `${w.avg_verify_hours} h`])} />
        </div>
      </div>

      <div className="grid gap-[22px] lg:grid-cols-2">
        {/* Funnel */}
        <div className={CARD}>
          <Title icon={<Filter className="h-4 w-4" />} note={f.avg_days_to_decision != null ? `${f.avg_days_to_decision} days to a decision on average` : undefined}>
            New Applications
          </Title>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px]">
            {[['Submitted', f.submitted], ['Interviewed', f.interviewed], ['Approved', f.approved]].map(([label, n], i) => (
              <span key={String(label)} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-ink-300" />}
                <span className="rounded-lg bg-ink-50 px-3 py-1.5"><b className="tabular-nums text-ink-950">{n}</b> <span className="text-ink-500">{label}</span></span>
              </span>
            ))}
            <span className="rounded-lg bg-danger-50 px-3 py-1.5 text-danger-700"><b className="tabular-nums">{f.rejected}</b> rejected</span>
            <span className="rounded-lg bg-warning-50 px-3 py-1.5 text-warning-800"><b className="tabular-nums">{f.waiting}</b> waiting</span>
            <span className="rounded-lg bg-ink-50 px-3 py-1.5 text-ink-600"><b className="tabular-nums">{f.no_shows}</b> interview no-show{f.no_shows === 1 ? '' : 's'}</span>
          </div>
          <Table headers={['College', 'Applications', 'Approved', 'Rejected']} numeric={[1, 2, 3]} empty="No new applications this term."
            rows={f.by_college.map((c) => [c.college, c.total, c.approved, c.rejected])} />
        </div>

        {/* Offices */}
        <div className={CARD}>
          <Title icon={<Building2 className="h-4 w-4" />}>Office Use</Title>
          <Table headers={['Office', 'Filled / Capacity', 'Verified hrs', 'Avg completion']} numeric={[1, 2, 3]} empty="No active offices."
            rows={data.offices.map((o) => [
              o.office,
              <span key="c" className={o.capacity > 0 && o.filled >= o.capacity ? 'font-bold text-warning-700' : ''}>{o.filled} / {o.capacity}</span>,
              num(o.verified_hours),
              o.avg_completion == null ? '—' : `${o.avg_completion}%`,
            ])} />
        </div>
      </div>
    </div>
  )
}
