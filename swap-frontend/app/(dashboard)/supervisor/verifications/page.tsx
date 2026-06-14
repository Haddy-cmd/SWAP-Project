'use client'

import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

export default function VerificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })

  const students = ((data as { data?: unknown[] })?.data ?? []) as Array<Record<string, unknown>>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Verifications</h1>
        <p className="mt-1 text-sm text-[#64748B]">Review pending attendance logs from your students.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-[#E2E8F0]" />)}
        </div>
      ) : !students.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#94A3B8]">No students assigned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s, i) => {
            const userId = String(s.user_id ?? s.id ?? '')
            const user = (s.user ?? {}) as Record<string, unknown>
            return (
              <Link
                key={i}
                href={`/supervisor/students/${userId}/logs`}
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="font-semibold text-[#1E293B]">{String(user.name ?? '—')}</p>
                  <p className="text-xs text-[#64748B]">{String(s.office_name ?? '—')}</p>
                </div>
                <span className="rounded-full bg-[#F39C12]/10 px-3 py-1 text-xs font-bold text-[#F39C12]">
                  Review Logs
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
