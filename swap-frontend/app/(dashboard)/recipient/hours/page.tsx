'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { TimeLogCard } from '@/components/attendance/TimeLogCard'
import { DataTable } from '@/components/shared/DataTable'
import type { TimeLog } from '@/types/attendance.types'

export default function HoursPage() {
  const [page] = useState(1)

  const { data: summary } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

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
        <p className="text-sm text-[#94A3B8]">
          Your time logs appear here. Use the scan page to clock in/out each service day.
        </p>
      </div>
    </div>
  )
}
