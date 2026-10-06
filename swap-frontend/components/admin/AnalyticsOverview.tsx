'use client'

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Users, Clock, TrendingUp, CalendarDays, GraduationCap, ArrowUpRight } from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import type { ReportDrill } from '@/lib/utils/reportQuery'
import { MonthlyApplicationsChart } from '@/components/charts/MonthlyApplicationsChart'
import { ApplicantsByCollegeChart } from '@/components/charts/ApplicantsByCollegeChart'
import { ProgramInsights } from '@/components/admin/ProgramInsights'

// Seal-derived series order: green, gold, maroon, blue, teal, violet, grey.
const OFFICE_COLORS = ['#1F5B3A', '#D4AE22', '#A31A1E', '#2F5D8A', '#1F8163', '#6B4E9A', '#8C968F']
// Teal-led so the recipients-by-college bars read distinctly from the green-led
// applicants chart.
const RECIPIENT_COLORS = ['#1F8163', '#D4AE22', '#2F5D8A', '#A31A1E', '#6B4E9A', '#1F5B3A', '#8C968F']

const CARD = 'rounded-[15px] border border-ink-200 bg-white p-6 shadow-[0_2px_8px_rgba(19,36,26,0.04)]'
const PENDING = ['Submitted', 'Under Review', 'Interview Scheduled']

/** Build evenly-spaced "x,y" points for an SVG polyline, normalized to maxVal. */
function linePoints(values: number[], maxVal: number, w: number, h: number, pad = 14): string {
  const n = values.length
  return values
    .map((v, i) => {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w
      const y = h - pad - (maxVal > 0 ? v / maxVal : 0) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** A KPI card that opens the matching report when clicked. */
function Kpi({ onClick, className, children, label }: { onClick: () => void; className: string; children: ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={`Open ${label}`} className={`group relative text-left transition-shadow hover:shadow-[0_8px_22px_rgba(19,36,26,0.10)] ${className}`}>
      {children}
      <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  )
}

/**
 * Analytics & Reports → Overview: the term's KPIs and charts. Every chart, tile and
 * legend entry is a way in — clicking it opens the matching report tab already
 * filtered (e.g. a college bar → Applications filtered to that college).
 */
export function AnalyticsOverview({ academicYear, semester, onDrill }: { academicYear: string; semester: string; onDrill: (d: ReportDrill) => void }) {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview', academicYear, semester],
    queryFn: () => analyticsApi.getAdminOverview(academicYear, semester),
  })

  // Office donut
  const offices = overview?.office_distribution_all ?? []
  const totalRecipients = offices.reduce((s, o) => s + o.recipient_count, 0)
  let acc = 0
  const donutGradient = totalRecipients
    ? `conic-gradient(${offices
        .map((o, i) => {
          const pct = (o.recipient_count / totalRecipients) * 100
          const seg = `${OFFICE_COLORS[i % OFFICE_COLORS.length]} ${acc}% ${acc + pct}%`
          acc += pct
          return seg
        })
        .join(', ')})`
    : 'conic-gradient(#DCE0CF 0 100%)'

  // Weekly hours line chart
  const weekly = overview?.weekly_hours ?? []
  const weeklyMax = Math.max(1, ...weekly.flatMap((w) => [w.verified, w.pending]))
  const verifiedPts = linePoints(weekly.map((w) => w.verified), weeklyMax, 460, 128)
  const pendingPts = linePoints(weekly.map((w) => w.pending), weeklyMax, 460, 128)
  const weekRange = weekly.length ? `${weekly[0].week} – ${weekly[weekly.length - 1].week}` : ''

  const monthly = (overview?.monthly_stats ?? []).map((m) => ({
    month: m.month,
    submitted: m.total_applications,
    approved: m.approved,
    rejected: m.rejected,
  }))

  // Applicants and active recipients, broken down by the student's college. The chart uses a generic `value` key.
  const byCollege = (overview?.applicants_by_college ?? []).map((c) => ({ college: c.college, value: c.applicant_count }))
  const collegeTotal = byCollege.reduce((s, c) => s + c.value, 0)
  const recipientsByCollege = (overview?.recipients_by_college ?? []).map((c) => ({ college: c.college, value: c.recipient_count }))
  const recipientCollegeTotal = recipientsByCollege.reduce((s, c) => s + c.value, 0)

  const pending = overview?.pending_applications ?? 0
  const completion = overview != null ? Number(overview.avg_completion_rate ?? 0).toFixed(1) : '—'

  return (
    <div className="space-y-[22px]">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Applications" className={`${CARD} p-5`} onClick={() => onDrill({ tab: 'applications' })}>
          <div className="mb-3.5 flex items-center gap-2"><FileText className="h-[17px] w-[17px] text-brand-700" /><span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">Applications</span></div>
          <div className="font-serif text-[38px] font-semibold leading-none text-ink-950">{overview?.total_applications ?? '—'}</div>
        </Kpi>
        <Kpi label="Recipients" className={`${CARD} p-5`} onClick={() => onDrill({ tab: 'recipients', filters: { status: ['Active'] } })}>
          <div className="mb-3.5 flex items-center gap-2"><Users className="h-[17px] w-[17px] text-success-600" /><span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">Recipients</span></div>
          <div className="font-serif text-[38px] font-semibold leading-none text-ink-950">{overview?.active_recipients ?? '—'}</div>
        </Kpi>
        <Kpi label="pending applications" className={`${CARD} p-5`} onClick={() => onDrill({ tab: 'applications', filters: { status: PENDING } })}>
          <div className="mb-3.5 flex items-center gap-2"><Clock className="h-[17px] w-[17px] text-gold-600" /><span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">Pending</span></div>
          <div className="flex items-end justify-between">
            <span className="font-serif text-[38px] font-semibold leading-none text-ink-950">{pending}</span>
            {overview && pending === 0 && <span className="rounded-md bg-success-50 px-2 py-1 text-[11px] font-semibold text-success-600">Clear</span>}
          </div>
        </Kpi>
        <Kpi label="Recipients & Hours" className="rounded-[15px] bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-ink-25"
          onClick={() => onDrill({ tab: 'recipients', sort: 'verified_hours', dir: 'asc' })}>
          <div className="mb-3.5 flex items-center gap-2"><TrendingUp className="h-[17px] w-[17px] text-gold-300" /><span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gold-300/85">Completion</span></div>
          <div className="flex items-end gap-2">
            <span className="font-serif text-[38px] font-semibold leading-none text-ink-25">{completion}%</span>
            <span className="pb-1 text-[11px] text-gold-300/80">of 200h</span>
          </div>
        </Kpi>
      </div>

      {/* Bento grid */}
      <div className="grid gap-3.5 lg:grid-cols-4">
        {/* Office Distribution donut (2x2) */}
        <div className={`${CARD} flex flex-col lg:col-span-2 lg:row-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[15px] font-bold text-ink-950">Office Distribution</div>
            <span className="rounded-lg bg-ink-100 px-3 py-1.5 text-xs text-ink-500">{totalRecipients} recipients</span>
          </div>
          <div className="my-2 flex flex-1 items-center justify-center">
            <div className="flex h-[188px] w-[188px] items-center justify-center rounded-full" style={{ background: donutGradient }}>
              <div className="flex h-[116px] w-[116px] flex-col items-center justify-center rounded-full bg-white">
                <span className="font-serif text-[34px] font-semibold leading-none text-ink-950">{totalRecipients}</span>
                <span className="text-[10.5px] text-ink-400">recipients</span>
              </div>
            </div>
          </div>
          {offices.length === 0 ? (
            <p className="py-2 text-center text-[12.5px] text-ink-400">No active assignments yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">
              {offices.map((o, i) => {
                const pct = totalRecipients ? Math.round((o.recipient_count / totalRecipients) * 100) : 0
                return (
                  <button key={o.office_name} onClick={() => onDrill({ tab: 'recipients', filters: { office: [o.office_name] } })}
                    title={`Open Recipients & Hours for ${o.office_name}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-ink-600 hover:bg-ink-50 hover:text-ink-900">
                    <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ backgroundColor: OFFICE_COLORS[i % OFFICE_COLORS.length] }} />
                    <span className="truncate">{o.office_name}</span>
                    <span className="ml-auto flex-shrink-0 text-ink-400">{pct}%</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Weekly Hours line chart (2 wide) */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[15px] font-bold text-ink-950">Weekly Hours</div>
            {weekRange && <span className="text-[11.5px] text-ink-500">{weekRange}</span>}
          </div>
          {weekly.length === 0 ? (
            <div className="flex h-[128px] items-center justify-center text-[12.5px] text-ink-400">No hours logged this period yet.</div>
          ) : (
            <>
              <svg width="100%" height="128" viewBox="0 0 460 128" preserveAspectRatio="none">
                {[22, 56, 90, 122].map((y, i) => (
                  <line key={y} x1="0" y1={y} x2="460" y2={y} stroke={i === 3 ? '#DCE0CF' : '#ECEFE2'} strokeWidth="1" />
                ))}
                <polyline points={pendingPts} fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={verifiedPts} fill="none" stroke="#1F8163" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-3 flex gap-5">
                <span className="flex items-center gap-1.5 text-xs text-ink-600"><span className="h-[3px] w-4 rounded-sm bg-success-600" />Verified Hours</span>
                <span className="flex items-center gap-1.5 text-xs text-ink-600"><span className="h-[3px] w-4 rounded-sm bg-warning-500" />Pending Hours</span>
              </div>
            </>
          )}
        </div>

        {/* Monthly Applications (2 wide) */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-3 text-[14px] font-bold text-ink-950">Monthly Applications</div>
          {isLoading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-ink-100" />
          ) : monthly.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[11px] border border-dashed border-ink-300 bg-ink-50 p-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-ink-100 text-gold-600"><CalendarDays className="h-5 w-5" /></span>
              <p className="text-[12.5px] leading-snug text-ink-600">No applications this period yet — new submissions will chart here monthly.</p>
            </div>
          ) : (
            <MonthlyApplicationsChart data={monthly} />
          )}
        </div>

        {/* Applicants by College (full width) */}
        <div className={`${CARD} lg:col-span-4`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-bold text-ink-950">Applicants by College</div>
            <div className="flex items-center gap-2">
              {collegeTotal > 0 && <span className="hidden text-[11.5px] text-ink-400 sm:inline">Click a bar to see those applicants</span>}
              {collegeTotal > 0 && <span className="rounded-lg bg-ink-100 px-3 py-1.5 text-xs text-ink-500">{collegeTotal} applicants</span>}
            </div>
          </div>
          {isLoading ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-ink-100" />
          ) : byCollege.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[11px] border border-dashed border-ink-300 bg-ink-50 p-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-ink-100 text-gold-600"><GraduationCap className="h-5 w-5" /></span>
              <p className="text-[12.5px] leading-snug text-ink-600">No applicants this period yet — submissions will break down by college here.</p>
            </div>
          ) : (
            <ApplicantsByCollegeChart data={byCollege} onBarClick={(college) => onDrill({ tab: 'applications', filters: { college: [college] } })} />
          )}
        </div>

        {/* Active Recipients by College (full width) */}
        <div className={`${CARD} lg:col-span-4`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-bold text-ink-950">Active Recipients by College</div>
            <div className="flex items-center gap-2">
              {recipientCollegeTotal > 0 && <span className="hidden text-[11.5px] text-ink-400 sm:inline">Click a bar to see those recipients</span>}
              {recipientCollegeTotal > 0 && <span className="rounded-lg bg-success-50 px-3 py-1.5 text-xs text-success-800">{recipientCollegeTotal} recipients</span>}
            </div>
          </div>
          {isLoading ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-ink-100" />
          ) : recipientsByCollege.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[11px] border border-dashed border-ink-300 bg-ink-50 p-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-success-50 text-success-800"><Users className="h-5 w-5" /></span>
              <p className="text-[12.5px] leading-snug text-ink-600">No active recipients this period yet — approved applicants assigned to an office appear here by college.</p>
            </div>
          ) : (
            <ApplicantsByCollegeChart data={recipientsByCollege} label="Recipients" colors={RECIPIENT_COLORS} emptyMessage="No active recipients this period"
              onBarClick={(college) => onDrill({ tab: 'recipients', filters: { college: [college], status: ['Active'] } })} />
          )}
        </div>
      </div>

      {/* Term results, renewals, stipend, integrity, workload, funnel, offices */}
      <ProgramInsights academicYear={academicYear} semester={semester} onDrill={onDrill} />
    </div>
  )
}
