'use client'

import { Suspense, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote, Building2, ClipboardList, Clock, FileText, Gavel, LayoutDashboard, Table2, UserCheck, Users, Wallet,
} from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import { reportsApi } from '@/lib/api/reports.api'
import { useReportUrlState } from '@/lib/hooks/useReportUrlState'
import { ReportExplorer } from '@/components/reports/ReportExplorer'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { TermSelect, resolveTerm } from '@/components/reports/TermSelect'
import { OverviewTab } from '@/components/admin/analytics/OverviewTab'
import { ApplicationsTab } from '@/components/admin/analytics/ApplicationsTab'
import { HoursTab } from '@/components/admin/analytics/HoursTab'
import { SupervisorsTab } from '@/components/admin/analytics/SupervisorsTab'
import { MoneyTab } from '@/components/admin/analytics/MoneyTab'

type Icon = ComponentType<{ className?: string }>

// The summary tabs (layout "SWAP Admin Analytics v2").
const TABS: { key: string; label: string; icon: Icon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'apps', label: 'Applications', icon: FileText },
  { key: 'hours', label: 'Hours & offices', icon: Clock },
  { key: 'supervisors', label: 'Supervisors', icon: UserCheck },
  { key: 'money', label: 'Stipend & renewals', icon: Wallet },
]

// "All reports": every record, filtered / sorted / grouped on the server, with PDF and CSV.
// Their keys are the URL's `tab` values from before v2, so older links still open them.
const REPORTS: { key: string; label: string; icon: Icon }[] = [
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'recipients', label: 'Recipients & Hours', icon: Users },
  { key: 'term-results', label: 'Term Results', icon: Gavel },
  { key: 'stipend', label: 'Stipend', icon: Banknote },
  { key: 'offices', label: 'Offices', icon: Building2 },
]

/**
 * Admin → Analytics & reports. Five summary tabs answer "how is SWAP doing this semester";
 * their numbers open the matching detailed report under All reports, already filtered.
 * The term, tab and every filter live in the URL.
 */
function AdminAnalyticsReports() {
  const { state, update, openTab, drill, setTerm } = useReportUrlState()
  const { data: periods = [] } = useQuery({ queryKey: ['admin-periods'], queryFn: () => analyticsApi.getPeriods() })

  const term = resolveTerm(state.ay, state.sem, periods)
  const report = REPORTS.find((r) => r.key === state.tab)?.key ?? null
  const tab = report ? 'reports' : TABS.some((t) => t.key === state.tab) ? state.tab! : 'overview'
  const props = { academicYear: term.academic_year, semester: term.semester, onDrill: drill }

  return (
    <div className="space-y-5 text-ink-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-950">Analytics &amp; reports</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">The short version of how SWAP is doing this semester.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <TermSelect term={term} periods={periods} onChange={(t) => setTerm(t.academic_year, t.semester)} />
          <ExportButtons
            formats={['pdf']}
            download={() => reportsApi.overviewPdf(term.academic_year, term.semester)}
            fallbackName={`program-overview-${term.academic_year}-${term.semester.replace(/\s+/g, '').toLowerCase()}`}
            label="Download summary"
          />
        </div>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-ink-900/[.08]">
        {[...TABS, { key: 'reports', label: 'All reports', icon: Table2 }].map((t) => {
          const on = t.key === tab
          return (
            <button key={t.key} role="tab" aria-selected={on}
              onClick={() => openTab(t.key === 'reports' ? 'applications' : t.key)}
              className={`-mb-px flex h-[46px] flex-none items-center gap-2 border-b-[3px] px-3.5 text-[14px] transition-colors ${
                on ? 'border-[#17815F] font-bold text-ink-950' : 'border-transparent font-semibold text-ink-500 hover:text-ink-800'}`}>
              <t.icon className={`h-[18px] w-[18px] ${on ? 'text-[#17815F]' : ''}`} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <OverviewTab {...props} onTab={openTab} />}
      {tab === 'apps' && <ApplicationsTab key={`${term.academic_year}-${term.semester}`} {...props} />}
      {tab === 'hours' && <HoursTab {...props} />}
      {tab === 'supervisors' && <SupervisorsTab {...props} />}
      {tab === 'money' && <MoneyTab {...props} />}
      {tab === 'reports' && report && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Report">
            <ClipboardList className="mr-0.5 h-4 w-4 text-ink-400" />
            {REPORTS.map((r) => {
              const on = r.key === report
              return (
                <button key={r.key} role="tab" aria-selected={on} onClick={() => openTab(r.key)}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                    on ? 'border-[#063D27] bg-[#063D27] text-white' : 'border-ink-200 bg-white text-ink-600 hover:text-[#17815F]'}`}>
                  <r.icon className="h-4 w-4" /> {r.label}
                </button>
              )
            })}
          </div>
          <ReportExplorer role="admin" type={report} term={term} state={state} onChange={update} />
        </div>
      )}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="mx-auto h-[600px] max-w-[1280px] animate-pulse rounded-[15px] bg-ink-100" />}>
      <AdminAnalyticsReports />
    </Suspense>
  )
}
