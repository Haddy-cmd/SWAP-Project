'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api/analytics.api'
import { MonthlyApplicationsChart } from '@/components/charts/MonthlyApplicationsChart'
import { OfficeDistributionChart } from '@/components/charts/OfficeDistributionChart'
import { StipendSummaryChart } from '@/components/charts/StipendSummaryChart'
import { WeeklyHoursTrendChart } from '@/components/charts/WeeklyHoursTrendChart'

const YEARS = ['2024-2025', '2025-2026']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

export default function AdminAnalyticsPage() {
  const [year, setYear] = useState('2024-2025')
  const [semester, setSemester] = useState('1st Semester')

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview', year, semester],
    queryFn: () => analyticsApi.getAdminOverview(year, semester),
  })

  const monthly = (overview?.monthly_stats ?? []).map((m) => ({
    month: m.month,
    submitted: m.total_applications,
    approved: m.approved,
    rejected: m.rejected,
  }))

  // Use the all-active distribution (same as the Admin Dashboard) so it matches the
  // "Active Recipients" KPI, rather than scoping to the selected period.
  const offices = (overview?.office_distribution_all ?? []).map((o) => ({
    office: o.office_name,
    count: o.recipient_count,
  }))

  const stipend = overview
    ? [{
        month: 'This Semester',
        released: overview.stipend_summary.total_released,
        pending: overview.stipend_summary.total_pending,
      }]
    : []

  const weekly = (overview?.weekly_hours ?? []).map((w) => ({
    week: w.week,
    verified: w.verified,
    pending: w.pending,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Analytics</h1>
        <div className="flex gap-3">
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm focus:border-[#7D1A1A] focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)}
            className="rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm focus:border-[#7D1A1A] focus:outline-none">
            {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Applications', value: overview.total_applications },
            { label: 'Active Recipients', value: overview.active_recipients },
            { label: 'Pending Review', value: overview.pending_applications },
            { label: 'Completion Rate', value: `${Number(overview.avg_completion_rate ?? 0).toFixed(1)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
              <p className="text-xs text-[#8A6A6A]">{label}</p>
              <p className="mt-1 text-2xl font-bold text-[#7D1A1A]">{String(value ?? '—')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Monthly Applications</h2>
          {isLoading ? <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" /> : <MonthlyApplicationsChart data={monthly} />}
        </div>
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Office Distribution</h2>
          {isLoading ? <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" /> : <OfficeDistributionChart data={offices} />}
        </div>
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Stipend Disbursement</h2>
          {isLoading ? <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" /> : <StipendSummaryChart data={stipend} />}
        </div>
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Weekly Hours Trend</h2>
          {isLoading ? <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" /> : <WeeklyHoursTrendChart data={weekly} />}
        </div>
      </div>
    </div>
  )
}
