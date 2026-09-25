'use client'

import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, CheckSquare, Clock, AlertCircle, CheckCircle, ArrowRight, Check, MapPinOff, Sparkles, ShieldAlert, TrendingDown } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { needsReview } from '@/lib/utils/attendanceReview'
import { isBehind, paceDetail, type Pace } from '@/lib/utils/pace'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'
import { formatHours } from '@/lib/utils/formatHours'

function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base'
  return (
    <UserAvatar name={name} avatarUrl={avatarUrl}
      className={`${dim} rounded-full bg-gradient-to-br from-gold-300 to-gold-500 font-extrabold text-brand-950`} />
  )
}

type StudentRow = {
  user?: { name?: string; avatar_url?: string | null }
  name?: string
  office_name?: string
  user_id?: number
  id?: number
  pending_logs_count?: number
  verified_hours?: number
  required_hours?: number
  pace?: Pace
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

  // Students whose verified hours have fallen behind the elapsed term, worst first,
  // so a supervisor can intervene while there's still semester left to catch up in.
  const atRisk = students
    .filter((s) => isBehind(s.pace))
    .sort((a, b) => (b.pace?.deficit_hours ?? 0) - (a.pace?.deficit_hours ?? 0))

  const nameOf = (s: StudentRow) => String(s.user?.name ?? s.name ?? '—')
  const idOf = (s: StudentRow) => String(s.user_id ?? s.id ?? '')

  const STATS = [
    { icon: Users, tint: 'bg-brand-50 text-brand-700', value: studentCount, label: 'My Students', href: '/supervisor/students' },
    { icon: Clock, tint: 'bg-warning-50 text-warning-600', value: pendingVerifications, label: 'Pending Verifications', href: '/supervisor/verifications' },
    { icon: CheckSquare, tint: 'bg-success-50 text-success-600', value: verifiedThisWeek, label: 'Verified This Week', href: '/supervisor/verifications' },
  ]

  return (
    <div className="space-y-6">
      {/* Light header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Good day, {user?.name}</h1>
        <p className="mt-1 text-sm text-ink-500">{studentCount} recipient{studentCount === 1 ? '' : 's'} under your supervision.</p>
      </div>

      {/* Segmented stats bar */}
      <div className="grid grid-cols-1 divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STATS.map(({ icon: Icon, tint, value, label, href }) => (
          <Link key={label} href={href} className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-ink-50">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-ink-900">{value}</p>
              <p className="text-xs text-ink-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Action center: Needs Your Attention */}
      <div className="rounded-2xl border border-maroon-200 bg-maroon-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-maroon-700" />
            <h2 className="font-bold text-maroon-700">Needs Your Attention</h2>
            {pendingLogs.length > 0 && (
              <span className="rounded-full bg-warning-600 px-2 py-0.5 text-xs font-bold text-white">{pendingLogs.length}</span>
            )}
            {flaggedCount > 0 && (
              <Link href="/supervisor/verifications"
                title="These logs were flagged, or have no clock-in selfie — review them individually"
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-bold text-warning-700 ring-1 ring-warning-200 hover:bg-warning-100 transition-colors">
                <ShieldAlert className="h-3.5 w-3.5" />
                {flaggedCount} {flaggedCount === 1 ? 'log needs' : 'logs need'} a closer look
              </Link>
            )}
          </div>
          <Link href="/supervisor/verifications" className="text-xs font-semibold text-brand-700 hover:text-brand-600 transition-colors">
            Go to verifications →
          </Link>
        </div>

        {pendingLogs.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white px-4 py-4">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-success-600" />
            <p className="text-sm font-medium text-success-800">You&apos;re all caught up — no attendance logs are waiting for verification.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {pendingLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={log.user?.name ?? '?'} avatarUrl={(log.user as { avatar_url?: string | null })?.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{log.user?.name ?? 'Recipient'}</p>
                    <p className="truncate text-xs text-ink-500">
                      {log.office?.name ?? '—'} · {log.date}
                      {log.duration_hours != null && ` · ${formatHours(log.duration_hours)}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  {log.is_manual && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      <Sparkles className="h-3 w-3" /> Bonus
                    </span>
                  )}
                  {log.location_flagged && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-800">
                      <MapPinOff className="h-3 w-3" /> Unverified
                    </span>
                  )}
                  <button
                    onClick={() => verify.mutate(log.id)}
                    disabled={verify.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-success-600 px-4 py-2 text-xs font-semibold text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Verify
                  </button>
                  <Link
                    href={`/supervisor/students/${log.user_id}/logs`}
                    className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
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

      {/* At-risk roster — only surfaces when someone is actually falling behind */}
      {atRisk.length > 0 && (
        <div className="rounded-2xl border border-warning-200 bg-white p-5 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-warning-700" />
              <h2 className="font-bold text-warning-700">Falling Behind</h2>
              <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-bold text-warning-700">{atRisk.length}</span>
            </div>
            <Link href="/supervisor/reports" className="text-xs font-semibold text-brand-700 hover:text-brand-600 transition-colors">
              Semester summary →
            </Link>
          </div>
          <p className="mb-4 text-xs text-ink-500">
            Verified hours are short of what the elapsed term expects. There is still time to intervene.
          </p>

          <div className="space-y-2.5">
            {atRisk.slice(0, 5).map((s) => {
              const pace = s.pace!
              const pct = Math.min(100, pace.percent)
              // How far along the term is — the bar the student should have reached by now.
              const expectedPct = pace.expected_hours != null && s.required_hours
                ? Math.min(100, (pace.expected_hours / s.required_hours) * 100)
                : null
              return (
                <Link key={idOf(s)} href={`/supervisor/students/${idOf(s)}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-25 p-3.5 hover:bg-gold-50 transition-colors">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={nameOf(s)} avatarUrl={s.user?.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{nameOf(s)}</p>
                      <p className="truncate text-xs text-ink-500">
                        {formatHours(s.verified_hours ?? 0)} of {s.required_hours ?? 0}h verified · {paceDetail(pace)}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-3 sm:w-auto">
                    <div className="relative h-2 w-full min-w-[120px] overflow-hidden rounded-full bg-ink-100 sm:w-40">
                      <div className="h-full rounded-full bg-warning-500" style={{ width: `${pct}%` }} />
                      {expectedPct != null && (
                        <span title={`Expected by now: ${formatHours(pace.expected_hours!)}h`}
                          className="absolute top-[-2px] h-3 w-0.5 rounded bg-warning-700" style={{ left: `${expectedPct}%` }} />
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs font-bold tabular-nums text-warning-700">{pct}%</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {atRisk.length > 5 && (
            <Link href="/supervisor/students" className="mt-3 inline-block text-xs font-semibold text-brand-700 hover:text-brand-600">
              View {atRisk.length - 5} more →
            </Link>
          )}
        </div>
      )}

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Currently Clocked In */}
        <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${clockedIn.length ? 'animate-pulse bg-success-600' : 'bg-ink-300'}`} />
            <h2 className="font-semibold text-ink-900">Currently Clocked In</h2>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-600">{clockedIn.length}</span>
          </div>
          {clockedIn.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-350">No one is on the clock right now.</p>
          ) : (
            <div className="space-y-2">
              {clockedIn.map((log) => (
                <Link
                  key={log.id}
                  href={`/supervisor/students/${log.user_id}/logs`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-3.5 py-3 hover:bg-success-50 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={log.user?.name ?? '?'} avatarUrl={(log.user as { avatar_url?: string | null })?.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{log.user?.name ?? 'Recipient'}</p>
                      <p className="truncate text-xs text-ink-500">
                        {log.office?.name ?? '—'}
                        {log.location_flagged && <span className="ml-1.5 font-medium text-warning-800">· location unverified</span>}
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
        <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">My Students</h2>
            <Link href="/supervisor/students" className="text-xs font-semibold text-brand-700 hover:text-brand-600 transition-colors">View all →</Link>
          </div>
          {!studentCount ? (
            <p className="py-6 text-center text-sm text-ink-400">No students assigned yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {students.slice(0, 5).map((s) => (
                <li key={idOf(s)} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={nameOf(s)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{nameOf(s)}</p>
                      <p className="truncate text-xs text-ink-500">{String(s.office_name ?? '—')}</p>
                    </div>
                  </div>
                  <Link
                    href={`/supervisor/students/${idOf(s)}`}
                    className="flex-shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-600 transition-colors"
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
