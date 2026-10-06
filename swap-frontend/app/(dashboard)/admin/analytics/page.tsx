'use client'

import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Building2, FileText, Gavel, LayoutDashboard, Users } from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import { reportsApi } from '@/lib/api/reports.api'
import { useReportUrlState } from '@/lib/hooks/useReportUrlState'
import { AnalyticsOverview } from '@/components/admin/AnalyticsOverview'
import { ReportExplorer } from '@/components/reports/ReportExplorer'
import { ReportTabs, type ReportTab } from '@/components/reports/ReportTabs'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { TermSelect, resolveTerm } from '@/components/reports/TermSelect'

const TABS: ReportTab[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'recipients', label: 'Recipients & Hours', icon: Users },
  { key: 'term-results', label: 'Term Results', icon: Gavel },
  { key: 'stipend', label: 'Stipend', icon: Banknote },
  { key: 'offices', label: 'Offices', icon: Building2 },
]

/**
 * Admin → Analytics & Reports. The Overview's charts and tiles open the report tabs
 * already filtered; every report tab filters, sorts and groups on the server and
 * downloads exactly what is shown as a PDF or CSV. All state lives in the URL.
 */
function AdminAnalyticsReports() {
  const { state, update, openTab, drill, setTerm } = useReportUrlState()
  const { data: periods = [] } = useQuery({ queryKey: ['admin-periods'], queryFn: () => analyticsApi.getPeriods() })

  const term = resolveTerm(state.ay, state.sem, periods)
  const tab = TABS.some((t) => t.key === state.tab) ? state.tab! : 'overview'

  return (
    <div className="mx-auto max-w-[1280px] space-y-[22px] text-ink-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Program Analytics</div>
          <h1 className="font-serif text-[34px] font-medium tracking-tight text-ink-950">Analytics &amp; Reports</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {tab === 'overview' && (
            <ExportButtonsOverview academicYear={term.academic_year} semester={term.semester} />
          )}
          <TermSelect term={term} periods={periods} onChange={(t) => setTerm(t.academic_year, t.semester)} />
        </div>
      </div>

      <ReportTabs tabs={TABS} active={tab} onSelect={openTab} />

      {tab === 'overview' ? (
        <AnalyticsOverview academicYear={term.academic_year} semester={term.semester} onDrill={drill} />
      ) : (
        <ReportExplorer role="admin" type={tab} term={term} state={state} onChange={update} />
      )}
    </div>
  )
}

/** The Overview's own download: KPIs + program insights as one PDF (it isn't a table, so no CSV). */
function ExportButtonsOverview({ academicYear, semester }: { academicYear: string; semester: string }) {
  return (
    <ExportButtons
      formats={['pdf']}
      download={() => reportsApi.overviewPdf(academicYear, semester)}
      fallbackName={`program-overview-${academicYear}-${semester.replace(/\s+/g, '').toLowerCase()}`}
    />
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
