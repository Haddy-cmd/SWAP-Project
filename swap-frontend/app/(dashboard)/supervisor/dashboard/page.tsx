'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Users, CheckSquare, Clock } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'

export default function SupervisorDashboard() {
  const { user } = useAuthStore()

  const { data: studentsData } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })

  // Live view of students currently on the clock — refreshed every 20s.
  const { data: clockedIn = [] } = useQuery({
    queryKey: ['supervisor-clocked-in'],
    queryFn: () => attendanceApi.getClockedInStudents(),
    refetchInterval: 20_000,
  })

  type StudentRow = {
    user?: { name?: string }
    name?: string
    office_name?: string
    user_id?: number
    id?: number
  }
  const typed = studentsData as { data?: StudentRow[]; meta?: { pending_verifications?: number; verified_this_week?: number } } | undefined
  const students = (typed?.data ?? []) as StudentRow[]
  const studentCount = students.length
  const pendingVerifications = typed?.meta?.pending_verifications ?? '—'
  const verifiedThisWeek = typed?.meta?.verified_this_week ?? '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">Manage your assigned SWAP recipients.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: <Users className="h-5 w-5 text-[#7D1A1A]" />, label: 'My Students', value: studentCount, href: '/supervisor/students' },
          { icon: <Clock className="h-5 w-5 text-[#F39C12]" />, label: 'Pending Verifications', value: pendingVerifications, href: '/supervisor/verifications' },
          { icon: <CheckSquare className="h-5 w-5 text-[#27AE60]" />, label: 'Verified This Week', value: verifiedThisWeek, href: '/supervisor/verifications' },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex items-center gap-4 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF0F0]">
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1E293B]">{card.value}</p>
              <p className="text-xs text-[#8A6A6A]">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {clockedIn.length > 0 && (
        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#27AE60]" />
            <h2 className="font-semibold text-[#1E293B]">Currently Clocked In</h2>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-[#27AE60]">{clockedIn.length}</span>
          </div>
          <div className="space-y-2">
            {clockedIn.map((log) => (
              <Link
                key={log.id}
                href={`/supervisor/students/${log.user_id}/logs`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#F1F5F9] px-4 py-3 hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1E293B]">{log.user?.name ?? 'Recipient'}</p>
                  <p className="text-xs text-[#8A6A6A]">
                    {log.office?.name ?? '—'}
                    {log.location_flagged && <span className="ml-2 font-medium text-[#92400E]">· location unverified</span>}
                  </p>
                </div>
                {log.time_in && <LiveTimerChip timeIn={log.time_in} />}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1E293B]">My Students</h2>
          <Link href="/supervisor/students" className="text-xs font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors">
            View all
          </Link>
        </div>
        {!studentCount ? (
          <p className="text-sm text-[#B09A9A]">No students assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {students.slice(0, 5).map((s, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-[#F5EDEC] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#1E293B]">{String(s.user?.name ?? s.name ?? '—')}</p>
                  <p className="text-xs text-[#8A6A6A]">{String(s.office_name ?? '—')}</p>
                </div>
                <Link
                  href={`/supervisor/students/${String(s.user_id ?? s.id ?? '')}`}
                  className="text-xs font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
