'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import type { HoursSummary } from '@/types/attendance.types'

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['student-logs', studentId],
    queryFn: () => attendanceApi.getStudentLogs(Number(studentId)),
    enabled: !!studentId,
  })

  const logs = logsData?.data ?? []
  const verified = logs.filter((l) => l.status === 'verified').reduce((s, l) => s + (l.duration_hours ?? 0), 0)
  const pending = logs.filter((l) => l.status === 'pending_verification').reduce((s, l) => s + (l.duration_hours ?? 0), 0)
  const rejected = logs.filter((l) => l.status === 'rejected').reduce((s, l) => s + (l.duration_hours ?? 0), 0)
  const required = 240

  const summary: HoursSummary = {
    required,
    rendered: verified + pending,
    verified,
    pending,
    rejected,
    remaining: Math.max(0, required - verified),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/supervisor/students"
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Student #{studentId}</h1>
          <p className="text-sm text-[#64748B]">Service hours overview</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-[#1E293B]">Hours Summary</h2>
        <HoursProgress summary={summary} />
      </div>

      <div className="flex justify-end">
        <Link
          href={`/supervisor/students/${studentId}/logs`}
          className="rounded-xl bg-[#1B4F72] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors"
        >
          View Attendance Logs
        </Link>
      </div>
    </div>
  )
}
