'use client'

import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api/reports.api'
import { MonthlyApplicationsChart } from '@/components/charts/MonthlyApplicationsChart'

export default function MonthlyReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['monthly-reports'],
    queryFn: () => reportsApi.getMonthlyReports(),
  })

  const chartData = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    month: String(r.month_label ?? r.month ?? ''),
    submitted: Number(r.rendered_hours ?? 0),
    approved: Number(r.verified_hours ?? 0),
    rejected: Number(r.rejected_hours ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Monthly Report</h1>
        <p className="mt-1 text-sm text-[#64748B]">Hours breakdown by month.</p>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-[#E2E8F0]" />
        ) : chartData.length ? (
          <MonthlyApplicationsChart data={chartData} />
        ) : (
          <p className="py-12 text-center text-sm text-[#94A3B8]">No data available yet.</p>
        )}
      </div>
    </div>
  )
}
