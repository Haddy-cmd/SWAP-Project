'use client'

import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api/reports.api'
import { WeeklyHoursTrendChart } from '@/components/charts/WeeklyHoursTrendChart'
import { FileDown } from 'lucide-react'

export default function WeeklyReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => reportsApi.getWeeklyReports(),
  })

  const chartData = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    week: String(r.week_label ?? r.week ?? ''),
    verified: Number(r.verified_hours ?? 0),
    pending: Number(r.pending_hours ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Weekly Report</h1>
          <p className="mt-1 text-sm text-[#64748B]">Your service hours grouped by week.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-[#E2E8F0]" />
        ) : chartData.length ? (
          <WeeklyHoursTrendChart data={chartData} />
        ) : (
          <p className="py-12 text-center text-sm text-[#94A3B8]">No data available yet.</p>
        )}
      </div>
    </div>
  )
}
