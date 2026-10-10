'use client'

import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gavel, LayoutDashboard, Users } from 'lucide-react'
import { supervisorApi } from '@/lib/api/supervisor.api'
import { useReportUrlState } from '@/lib/hooks/useReportUrlState'
import { SupervisorInsights } from '@/components/supervisor/SupervisorInsights'
import { ReportExplorer } from '@/components/reports/ReportExplorer'
import { ReportTabs, type ReportTab } from '@/components/reports/ReportTabs'
import { TermSelect, resolveTerm } from '@/components/reports/TermSelect'

const TABS: ReportTab[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'roster', label: 'My Students', icon: Users },
  { key: 'term-results', label: 'Term Results', icon: Gavel },
]

/**
 * Supervisor → Analytics & Reports, over the students they can see (assigned to them
 * or hosted at their office). My Students is the service-hours sheet for the DSA;
 * Term Results is how a chosen term ended. Both filter, sort and download as PDF/CSV.
 */
function SupervisorAnalyticsReports() {
  const { state, update, openTab, setTerm } = useReportUrlState()
  const tab = TABS.some((t) => t.key === state.tab) ? state.tab! : 'overview'

  const { data: periods = [] } = useQuery({
    queryKey: ['supervisor-report-periods'],
    queryFn: () => supervisorApi.getReportPeriods(),
    enabled: tab === 'term-results',
  })
  const term = resolveTerm(state.ay, state.sem, periods)

  return (
    <div className="space-y-[22px] text-ink-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Your Students</p>
          <h1 className="font-serif text-[34px] font-medium tracking-tight text-ink-950">Analytics &amp; Reports</h1>
          <p className="mt-1 text-sm text-ink-500">
            {tab === 'roster'
              ? 'Every current recipient under your supervision, with verified, pending and remaining hours — download it to hand to the DSA.'
              : tab === 'term-results'
                ? 'How each of your students ended the term: hours, verdict, end-of-term report, stipend and renewal.'
                : 'What needs your attention: the verification queue, inactive students and automatic clock-outs.'}
          </p>
        </div>
        {tab === 'term-results' && (
          <TermSelect term={term} periods={periods} onChange={(t) => setTerm(t.academic_year, t.semester)} />
        )}
      </div>

      <ReportTabs tabs={TABS} active={tab} onSelect={openTab} />

      {tab === 'overview' && <SupervisorInsights />}
      {tab === 'roster' && <ReportExplorer role="supervisor" type="roster" state={state} onChange={update} />}
      {tab === 'term-results' && (
        <ReportExplorer role="supervisor" type="term-results" term={term} state={state} onChange={update} />
      )}
    </div>
  )
}

export default function SupervisorReportsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="mx-auto h-[600px] max-w-[1280px] animate-pulse rounded-[15px] bg-ink-100" />}>
      <SupervisorAnalyticsReports />
    </Suspense>
  )
}
