'use client'

import { useState } from 'react'
import { Flag, ChevronRight } from 'lucide-react'
import { useChartType } from '@/components/charts/ChartTypeToggle'
import { formatHours } from '@/lib/utils/formatHours'
import { GREEN, Card, Labeled, Seg, Skeleton, plural, useAnalytics, type TabProps } from './shared'

// Seal-derived office colours (same order as elsewhere in the admin pages).
const OFFICE_COLORS = ['#1F5B3A', '#D4AF2A', '#A3201F', '#2E5C8A', '#1F8466', '#6B4E9A', '#8C968F']

/**
 * Hours & offices: service hours logged per week (verified + waiting), and every office's
 * students, verified hours and flagged attendance logs. An office opens its recipients.
 */
export function HoursTab({ academicYear, semester, onDrill }: TabProps) {
  const { overview, insights, loading } = useAnalytics(academicYear, semester)
  const [view, setView] = useChartType('analytics-hours-week', ['column', 'line'] as const, 'column')
  const [sort, setSort] = useState<'hours' | 'flag' | 'name'>('hours')
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  if (loading && !overview) return <div className="grid gap-5 lg:grid-cols-2"><Skeleton h="h-80" /><Skeleton h="h-80" /></div>

  const weeks = (overview?.weekly_hours ?? []).map((w) => ({ label: w.week, n: Math.round((w.verified + w.pending) * 10) / 10, verified: w.verified, pending: w.pending }))
  const total = weeks.reduce((s, w) => s + w.n, 0)
  const max = Math.max(1, ...weeks.map((w) => w.n))

  const flags = new Map((insights?.integrity ?? []).map((i) => [i.office, i.flagged]))
  const offices = (insights?.offices ?? [])
    .map((o, i) => ({ ...o, flagged: flags.get(o.office) ?? 0, color: OFFICE_COLORS[i % OFFICE_COLORS.length] }))
    .filter((o) => !onlyFlagged || o.flagged > 0)
    .sort(sort === 'flag' ? (x, y) => y.flagged - x.flagged || y.verified_hours - x.verified_hours
      : sort === 'name' ? (x, y) => x.office.localeCompare(y.office) : (x, y) => y.verified_hours - x.verified_hours)

  // Line chart geometry (viewBox 300 × 180, points centred in each week's slot).
  const pts = weeks.map((w, i) => [((i + 0.5) / weeks.length) * 300, 180 - (w.n / max) * 144] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = pts.length ? `${pts[0][0].toFixed(1)},180 ${line} ${pts[pts.length - 1][0].toFixed(1)},180` : ''

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card title="Service hours per week" hint="Verified and waiting hours, by the week they were served"
        right={<Seg label="Hours chart" value={view} onChange={setView} options={[['column', 'Bars'], ['line', 'Line']] as const} />}>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-[30px] font-extrabold">{formatHours(total)}</span>
          <span className="text-[13px] text-ink-500">logged in the last {plural(weeks.length, 'week', 'weeks')}</span>
        </div>
        {weeks.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-[13px] text-ink-500">No hours logged this semester yet.</p>
        ) : view === 'column' ? (
          <>
            <div className="mt-[18px] flex h-[180px] items-end gap-3 border-b border-ink-900/[.08] px-2.5 sm:gap-6">
              {weeks.map((w) => (
                <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${w.label}: ${formatHours(w.verified)} verified, ${formatHours(w.pending)} waiting`}>
                  <span className="text-xs font-bold">{Math.round(w.n)}h</span>
                  <div className="w-full max-w-16 rounded-t-lg" style={{ height: `${Math.max(3, (w.n / max) * 88)}%`, background: 'linear-gradient(180deg,#2FA57C,#17815F)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-2.5 pt-2 sm:gap-6">
              {weeks.map((w) => <span key={w.label} className="flex-1 truncate text-center text-xs text-ink-500">{w.label}</span>)}
            </div>
          </>
        ) : (
          <>
            <div className="relative mt-[18px] h-[180px] border-b border-ink-900/[.08]"
              style={{ backgroundImage: 'linear-gradient(#EEF1EC 1px, transparent 1px)', backgroundSize: '100% 25%' }}>
              <svg viewBox="0 0 300 180" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <polygon points={area} fill="rgba(23,129,95,.12)" />
                <polyline points={line} fill="none" stroke={GREEN} strokeWidth={3} vectorEffect="non-scaling-stroke" />
              </svg>
              {weeks.map((w, i) => {
                const left = `${((i + 0.5) / weeks.length) * 100}%`
                const bottom = `${(w.n / max) * 80}%`
                return (
                  <span key={w.label} title={`${w.label}: ${formatHours(w.n)}`}>
                    <span className="absolute -mb-1.5 -ml-1.5 h-3 w-3 rounded-full border-[3px] border-[#17815F] bg-white" style={{ left, bottom }} />
                    <span className="absolute mb-2.5 -translate-x-1/2 text-xs font-bold" style={{ left, bottom }}>{Math.round(w.n)}h</span>
                  </span>
                )
              })}
            </div>
            <div className="flex pt-2">
              {weeks.map((w) => <span key={w.label} className="flex-1 truncate text-center text-xs text-ink-500">{w.label}</span>)}
            </div>
          </>
        )}
      </Card>

      <Card title="Offices at a glance" hint="Flagged = attendance logs whose location needs a second look. Click an office to see its recipients.">
        <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
          <Labeled label="Sort">
            <Seg label="Sort offices" value={sort} onChange={setSort} options={[['hours', 'Most hours'], ['flag', 'Most flagged'], ['name', 'A–Z']] as const} />
          </Labeled>
          <button onClick={() => setOnlyFlagged((v) => !v)} aria-pressed={onlyFlagged}
            className={`flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${onlyFlagged ? 'border-[#063D27] bg-[#063D27] text-white' : 'border-ink-200 bg-white text-ink-700'}`}>
            <Flag className="h-4 w-4" /> Only flagged
          </button>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_70px_64px_58px_16px] gap-2.5 border-b border-ink-900/[.06] pb-2 text-[11.5px] font-bold text-ink-500">
          <span>Office</span><span className="text-right">Students</span><span className="text-right">Hours</span><span className="text-right">Flagged</span><span />
        </div>
        {offices.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-500">{onlyFlagged ? 'No office has flagged logs.' : 'No offices yet.'}</p>
        ) : offices.map((o) => (
          <button key={o.office} onClick={() => onDrill({ tab: 'recipients', filters: { office: [o.office] } })}
            className="grid w-full grid-cols-[minmax(0,1fr)_70px_64px_58px_16px] items-center gap-2.5 border-b border-ink-900/[.04] py-[11px] text-left text-[13px] hover:bg-[#FAFBF8]">
            <span className="flex min-w-0 items-center gap-2"><span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: o.color }} /><span className="truncate">{o.office}</span></span>
            <span className={`text-right ${o.filled > o.capacity ? 'font-semibold text-[#A3201F]' : ''}`} title={o.filled > o.capacity ? 'Over the office limit' : undefined}>{o.filled}/{o.capacity}</span>
            <strong className="text-right">{Math.round(o.verified_hours)}h</strong>
            <span className="text-right">
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={o.flagged ? { color: '#A3201F', background: '#F6E1E0' } : { color: '#6B7A71', background: '#F1F3EE' }}>{o.flagged}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-300" />
          </button>
        ))}
      </Card>
    </div>
  )
}
