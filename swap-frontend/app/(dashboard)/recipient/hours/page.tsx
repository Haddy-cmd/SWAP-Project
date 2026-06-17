'use client'

import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { TimeLogCard } from '@/components/attendance/TimeLogCard'

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
