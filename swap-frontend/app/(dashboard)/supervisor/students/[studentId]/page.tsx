'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()

  const { data: result, isLoading } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: () => attendanceApi.getStudentSummary(Number(studentId)),
    enabled: !!studentId,
  })

  const summary = result?.data
  const studentName = result?.student?.name

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
          <h1 className="text-xl font-bold text-[#1E293B]">{studentName ?? `Student #${studentId}`}</h1>
          <p className="text-sm text-[#64748B]">Service hours overview</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-[#1E293B]">Hours Summary</h2>
        {isLoading || !summary ? (
          <div className="h-40 animate-pulse rounded-xl bg-[#E2E8F0]" />
        ) : (
          <HoursProgress summary={summary} />
        )}
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
