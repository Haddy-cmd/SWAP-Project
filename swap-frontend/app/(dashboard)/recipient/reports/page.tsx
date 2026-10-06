'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { CalendarClock, FileText, History, LayoutDashboard } from 'lucide-react'
import { useReportUrlState } from '@/lib/hooks/useReportUrlState'
import { PaceForecastCard, PayoutChecklistCard, HoursBreakdownCard } from '@/components/recipient/ProgressCards'
import { ReportExplorer } from '@/components/reports/ReportExplorer'
import { ReportTabs, type ReportTab } from '@/components/reports/ReportTabs'

const TABS: ReportTab[] = [
  { key: 'overview', label: 'My Progress', icon: LayoutDashboard },
  { key: 'time-logs', label: 'My Time Logs', icon: CalendarClock },
  { key: 'terms', label: 'My Terms', icon: History },
]

/**
 * Recipient → My Reports: progress this term, then every duty session and every term
 * so far — filterable (status, month, term), sortable and downloadable as a PDF or CSV.
 * The printed Duty Slip stays its own page.
 */
function RecipientReports() {
  const { state, update, openTab } = useReportUrlState()
  const tab = TABS.some((t) => t.key === state.tab) ? state.tab! : 'overview'

  return (
    <div className="mx-auto max-w-[1180px] space-y-[22px] text-ink-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Service Record</p>
          <h1 className="font-serif text-[34px] font-medium tracking-tight text-ink-950">My Reports</h1>
          <p className="mt-1 text-sm text-ink-500">Your hours, pace and terms in one place — filter them and download a copy for your records.</p>
        </div>
        <Link href="/recipient/reports/duty-slip"
          className="flex h-9 items-center gap-2 self-start rounded-[10px] border border-ink-200 bg-white px-3.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 sm:self-auto">
          <FileText className="h-4 w-4" /> Printable Duty Slip
        </Link>
      </div>

      <ReportTabs tabs={TABS} active={tab} onSelect={openTab} />

      {tab === 'overview' && (
        <div className="grid gap-[22px] lg:grid-cols-2">
          <PaceForecastCard />
          <PayoutChecklistCard />
          <div className="lg:col-span-2"><HoursBreakdownCard /></div>
        </div>
      )}
      {tab !== 'overview' && <ReportExplorer role="recipient" type={tab} state={state} onChange={update} />}
    </div>
  )
}

export default function RecipientReportsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="mx-auto h-[600px] max-w-[1180px] animate-pulse rounded-[15px] bg-ink-100" />}>
      <RecipientReports />
    </Suspense>
  )
}
