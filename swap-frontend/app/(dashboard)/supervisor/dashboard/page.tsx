'use client'

import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, CheckSquare, Clock, AlertCircle, CheckCircle, ArrowRight, Check, MapPinOff, Sparkles, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { needsReview } from '@/lib/utils/attendanceReview'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'
import { formatHours } from '@/lib/utils/formatHours'

function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base'
  return (
    <UserAvatar name={name} avatarUrl={avatarUrl}
      className={`${dim} rounded-full bg-gradient-to-br from-[#E6C66A] to-[#B8901F] font-extrabold text-[#531010]`} />
  )
}

type StudentRow = {
  user?: { name?: string }
  name?: string
  office_name?: string
  user_id?: number
  id?: number
  pending_logs_count?: number
}

export default function SupervisorDashboard() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: studentsData } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })

  const { data: clockedIn = [] } = useQuery({
    queryKey: ['supervisor-clocked-in'],
    queryFn: () => attendanceApi.getClockedInStudents(),
    refetchInterval: 20_000,
  })

  const { data: pendingLogs = [] } = useQuery({
    queryKey: ['supervisor-pending-logs'],
    queryFn: () => attendanceApi.getPendingVerifications(),
  })

  const verify = useMutation({
    mutationFn: (logId: number) => attendanceApi.verifyLog(logId, { action: 'verified', feedback: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-pending-logs'] })
      queryClient.invalidateQueries({ queryKey: ['supervisor-students'] })
    },
  })

  const typed = studentsData as { data?: StudentRow[]; meta?: { pending_verifications?: number; verified_this_week?: number } } | undefined
  const students = (typed?.data ?? []) as StudentRow[]
  const studentCount = students.length
  const pendingVerifications = typed?.meta?.pending_verifications ?? 0
  const verifiedThisWeek = typed?.meta?.verified_this_week ?? 0

  // Pending logs the server flagged (or that have no proof-of-presence selfie).
  const flaggedCount = pendingLogs.filter(needsReview).length

  const nameOf = (s: StudentRow) => String(s.user?.name ?? s.name ?? '—')
  const idOf = (s: StudentRow) => String(s.user_id ?? s.id ?? '')

  const STATS = [
    { icon: Users, tint: 'bg-[#FEF0F0] text-[#7D1A1A]', value: studentCount, label: 'My Students', href: '/supervisor/students' },
    { icon: Clock, tint: 'bg-[#FEF3E0] text-[#F39C12]', value: pendingVerifications, label: 'Pending Verifications', href: '/supervisor/verifications' },
    { icon: CheckSquare, tint: 'bg-[#EAF7EF] text-[#27AE60]', value: verifiedThisWeek, label: 'Verified This Week', href: '/supervisor/verifications' },
  ]

  return (
    <div className="space-y-6">
      {/* Light header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Good day, {user?.name}</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">{studentCount} recipient{studentCount === 1 ? '' : 's'} under your supervision.</p>
      </div>

      {/* Segmented stats bar */}
      <div className="grid grid-cols-1 divide-y divide-[#EFE3E3] overflow-hidden rounded-2xl border border-[#EAD9D9] bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STATS.map(({ icon: Icon, tint, value, label, href }) => (
          <Link key={label} href={href} className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-[#FAF7F7]">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#1E293B]">{value}</p>
              <p className="text-xs text-[#8A6A6A]">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Action center: Needs Your Attention */}
      <div className="rounded-2xl border border-[#F3D9D9] bg-[#FFF7F7] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#7D1A1A]" />
            <h2 className="font-bold text-[#7D1A1A]">Needs Your Attention</h2>
            {pendingLogs.length > 0 && (
              <span className="rounded-full bg-[#F39C12] px-2 py-0.5 text-xs font-bold text-white">{pendingLogs.length}</span>
            )}
            {flaggedCount > 0 && (
              <Link href="/supervisor/verifications"
                title="These logs were flagged, or have no clock-in selfie — review them individually"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF3E2] px-2.5 py-0.5 text-xs font-bold text-[#9A6B12] ring-1 ring-[#F0E4C6] hover:bg-[#F6E9CE] transition-colors">
                <ShieldAlert className="h-3.5 w-3.5" />
                {flaggedCount} {flaggedCount === 1 ? 'log needs' : 'logs need'} a closer look
              </Link>
            )}
          </div>
          <Link href="/supervisor/verifications" className="text-xs font-semibold text-[#7D1A1A] hover:text-[#A52020] transition-colors">
            Go to verifications →
          </Link>
        </div>

        {pendingLogs.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white px-4 py-4">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-[#27AE60]" />
            <p className="text-sm font-medium text-[#166534]">You&apos;re all caught up — no attendance logs are waiting for verification.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {pendingLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={log.user?.name ?? '?'} avatarUrl={(log.user as { avatar_url?: string | null })?.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1E293B]">{log.user?.name ?? 'Recipient'}</p>
                    <p className="truncate text-xs text-[#8A6A6A]">
                      {log.office?.name ?? '—'} · {log.date}
                      {log.duration_hours != null && ` · ${formatHours(log.duration_hours)}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  {log.is_manual && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF0F0] px-2 py-0.5 text-xs font-medium text-[#7D1A1A]">
                      <Sparkles className="h-3 w-3" /> Bonus
                    </span>
                  )}
                  {log.location_flagged && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[#92400E]">
                      <MapPinOff className="h-3 w-3" /> Unverified
                    </span>
                  )}
                  <button
                    onClick={() => verify.mutate(log.id)}
                    disabled={verify.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Verify
                  </button>
                  <Link
                    href={`/supervisor/students/${log.user_id}/logs`}
                    className="flex items-center gap-1 rounded-lg border border-[#EAD9D9] px-3 py-2 text-xs font-semibold text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
                  >
                    Review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Currently Clocked In */}
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${clockedIn.length ? 'animate-pulse bg-[#27AE60]' : 'bg-[#CBD5E1]'}`} />
            <h2 className="font-semibold text-[#1E293B]">Currently Clocked In</h2>
            <span className="rounded-full bg-[#EAF7EF] px-2 py-0.5 text-xs font-semibold text-[#27AE60]">{clockedIn.length}</span>
          </div>
          {clockedIn.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94A3B8]">No one is on the clock right now.</p>
          ) : (
            <div className="space-y-2">
              {clockedIn.map((log) => (
                <Link
                  key={log.id}
                  href={`/supervisor/students/${log.user_id}/logs`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#D8EFE0] bg-[#F6FBF7] px-3.5 py-3 hover:bg-[#EAF7EF] transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={log.user?.name ?? '?'} avatarUrl={(log.user as { avatar_url?: string | null })?.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1E293B]">{log.user?.name ?? 'Recipient'}</p>
                      <p className="truncate text-xs text-[#8A6A6A]">
                        {log.office?.name ?? '—'}
                        {log.location_flagged && <span className="ml-1.5 font-medium text-[#92400E]">· location unverified</span>}
                      </p>
                    </div>
                  </div>
                  {log.time_in && <LiveTimerChip timeIn={log.time_in} />}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Students */}
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#1E293B]">My Students</h2>
            <Link href="/supervisor/students" className="text-xs font-semibold text-[#7D1A1A] hover:text-[#A52020] transition-colors">View all →</Link>
          </div>
          {!studentCount ? (
            <p className="py-6 text-center text-sm text-[#B09A9A]">No students assigned yet.</p>
          ) : (
            <ul className="divide-y divide-[#F5EDEC]">
              {students.slice(0, 5).map((s) => (
                <li key={idOf(s)} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={nameOf(s)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1E293B]">{nameOf(s)}</p>
                      <p className="truncate text-xs text-[#8A6A6A]">{String(s.office_name ?? '—')}</p>
                    </div>
                  </div>
                  <Link
                    href={`/supervisor/students/${idOf(s)}`}
                    className="flex-shrink-0 text-xs font-semibold text-[#1B4F72] hover:text-[#2980B9] transition-colors"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
