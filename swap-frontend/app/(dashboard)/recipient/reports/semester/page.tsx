'use client'

import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api/reports.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import type { HoursSummary } from '@/types/attendance.types'

export default function SemesterReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['semester-report'],
    queryFn: () => reportsApi.getSemesterReport(),
  })

  const report = data as Record<string, unknown> | null

  const summary: HoursSummary | null = report
    ? {
        required: Number(report.required_hours ?? 0),
        rendered: Number(report.rendered_hours ?? 0),
        verified: Number(report.verified_hours ?? 0),
        pending: Number(report.pending_hours ?? 0),
        rejected: Number(report.rejected_hours ?? 0),
        remaining: Math.max(
          0,
          Number(report.required_hours ?? 0) - Number(report.verified_hours ?? 0),
        ),
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Semester Report</h1>
        <p className="mt-1 text-sm text-[#64748B]">Overall service hours for the current semester.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-[#E2E8F0]" />)}
        </div>
      ) : summary ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <HoursProgress summary={summary} />
        </div>
      ) : (
        <p className="text-sm text-[#94A3B8]">No semester report available.</p>
      )}

      {report && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Details</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            {[
              { label: 'Academic Year', value: String(report.academic_year ?? '—') },
              { label: 'Semester', value: String(report.semester ?? '—') },
              { label: 'Completion Rate', value: `${Number(report.completion_rate ?? 0).toFixed(1)}%` },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[#64748B]">{item.label}</dt>
                <dd className="mt-0.5 font-semibold text-[#1E293B]">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
