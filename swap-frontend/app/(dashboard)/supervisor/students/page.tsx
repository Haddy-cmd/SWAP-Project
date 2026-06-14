'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'

export default function SupervisorStudentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })

  const students = ((data as { data?: unknown[] })?.data ?? []) as Array<Record<string, unknown>>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">My Students</h1>
        <p className="mt-1 text-sm text-[#64748B]">SWAP recipients assigned to you.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-[#E2E8F0]" />)}
        </div>
      ) : !students.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] py-16 text-center">
          <Users className="h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#94A3B8]">No students assigned yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Office</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Verified Hrs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B]">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const userId = String(s.user_id ?? s.id ?? '')
                const user = (s.user ?? {}) as Record<string, unknown>
                return (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1E293B]">{String(user.name ?? '—')}</p>
                      <p className="text-xs text-[#94A3B8]">{String(user.email ?? '—')}</p>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{String(s.office_name ?? '—')}</td>
                    <td className="px-4 py-3 font-medium text-[#27AE60]">
                      {Number(s.verified_hours ?? 0).toFixed(1)} hrs
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/supervisor/students/${userId}`}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
