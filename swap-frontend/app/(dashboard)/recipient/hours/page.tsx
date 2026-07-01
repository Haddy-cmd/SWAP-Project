'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { TimeLogCard } from '@/components/attendance/TimeLogCard'
import { WeeklyHoursTrendChart } from '@/components/charts/WeeklyHoursTrendChart'
import type { TimeLog } from '@/types/attendance.types'

// Monday of the week containing d.
function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Group logs into weekly verified/pending buckets for the trend chart.
function buildWeekly(logs: TimeLog[]) {
  const map = new Map<string, { verified: number; pending: number; monday: Date }>()
  for (const l of logs) {
    if (!l.date || l.duration_hours == null) continue
    const monday = mondayOf(new Date(l.date.slice(0, 10) + 'T00:00:00'))
    const key = iso(monday)
    const bucket = map.get(key) ?? { verified: 0, pending: 0, monday }
    const hrs = Number(l.duration_hours) || 0
    if (l.status === 'verified') bucket.verified += hrs
    else if (l.status === 'pending_verification') bucket.pending += hrs
    map.set(key, bucket)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      week: v.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      verified: Math.round(v.verified * 100) / 100,
      pending: Math.round(v.pending * 100) / 100,
    }))
}

export default function HoursPage() {
  const { data: summary } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

  const { data: logsResult, isLoading: logsLoading } = useQuery({
    queryKey: ['my-logs'],
    queryFn: () => attendanceApi.getMyLogs(),
  })
  const logs = logsResult?.data ?? []

  // Wider fetch just for the weekly chart so the trend spans more than one page.
  const { data: weeklyResult } = useQuery({
    queryKey: ['my-logs', 'weekly-chart'],
    queryFn: () => attendanceApi.getMyLogs({ per_page: '100' }),
  })
  const weekly = useMemo(() => buildWeekly(weeklyResult?.data ?? []), [weeklyResult])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1E293B]">My Service Hours</h1>

      {summary && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="mb-5 font-semibold text-[#1E293B]">Hours Overview</h2>
          <HoursProgress summary={summary} />
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-[#1E293B]">Weekly Hours</h2>
        <p className="mb-4 text-sm text-[#64748B]">Your verified and pending service hours, grouped by week.</p>
        <WeeklyHoursTrendChart data={weekly} />
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-[#1E293B]">Attendance Logs</h2>

        {logsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-[#E2E8F0]" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Your time logs appear here. Use the scan page to clock in/out each service day.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <TimeLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
