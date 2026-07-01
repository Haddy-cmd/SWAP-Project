'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Clock, TrendingUp, FileText, Banknote, MapPin, UserCog, ArrowRight, Lightbulb, PartyPopper } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatHours, formatPercent, toPercent } from '@/lib/utils/formatHours'

const ACTIONS = [
  { href: '/recipient/attendance', icon: Clock, label: 'Time In / Out', sub: 'Scan your QR code' },
  { href: '/recipient/hours', icon: TrendingUp, label: 'My Hours', sub: 'View all logs' },
  { href: '/recipient/reports/duty-slip', icon: FileText, label: 'Duty Slip', sub: 'Print & submit' },
  { href: '/recipient/stipend', icon: Banknote, label: 'Stipend', sub: 'Disbursement history' },
]

function HoursRing({ verified, pending, required }: { verified: number; pending: number; required: number }) {
  const R = 70
  const C = 2 * Math.PI * R
  const vFrac = required > 0 ? Math.min(verified / required, 1) : 0
  const pFrac = required > 0 ? Math.min(pending / required, Math.max(0, 1 - vFrac)) : 0

  return (
    <div className="relative h-44 w-44 flex-shrink-0">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#EFE7E7" strokeWidth="16" />
        {/* amber covers verified+pending, green overlays the verified portion */}
        <circle cx="80" cy="80" r={R} fill="none" stroke="#F39C12" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${(vFrac + pFrac) * C} ${C}`} />
        <circle cx="80" cy="80" r={R} fill="none" stroke="#27AE60" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${vFrac * C} ${C}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-extrabold leading-none text-[#1E293B]">{formatHours(verified)}</p>
        <p className="mt-1 text-xs text-[#8A6A6A]">of {formatHours(required)}</p>
        <span className="mt-1.5 rounded-full bg-[#FEF0F0] px-2.5 py-0.5 text-[11px] font-bold text-[#7D1A1A]">
          {formatPercent(verified, required)}%
        </span>
      </div>
    </div>
  )
}

function LegendRow({ color, label, value, valueColor }: { color: string; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-xs text-[#8A6A6A]">{label}</p>
        <p className={`text-xl font-extrabold ${valueColor ?? 'text-[#1E293B]'}`}>{value}</p>
      </div>
    </div>
  )
}

export default function RecipientDashboard() {
  const { user } = useAuthStore()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

  const { data: currentLog } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: (query) => (query.state.data ? 20_000 : false),
  })

  const { data: assignment } = useQuery({
    queryKey: ['my-assignment'],
    queryFn: () => attendanceApi.getMyAssignment(),
  })

  const clockedIn = !!currentLog?.time_in
  const done = !!summary && summary.required > 0 && summary.remaining <= 0

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-6"
        style={{ background: 'linear-gradient(135deg, #8E1B1B 0%, #5C1010 60%, #7A1717 100%)' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D8B65A]/15 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E6C66A] to-[#B8901F] text-xl font-extrabold text-[#531010]">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E6C66A]">Welcome back</p>
              <h1 className="truncate text-xl font-bold sm:text-2xl">{user?.name}</h1>
              {assignment ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                  <span className="font-semibold text-white">{assignment.office?.name ?? 'Office'}</span>
                  {assignment.office?.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{assignment.office.location}</span>
                  )}
                  {assignment.supervisor?.name && (
                    <span className="inline-flex items-center gap-1"><UserCog className="h-3 w-3" />{assignment.supervisor.name}</span>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-white/70">No active office assignment yet.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex items-center justify-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-medium">
              <span className={`h-2 w-2 rounded-full ${clockedIn ? 'animate-pulse bg-[#34D399]' : 'bg-white/50'}`} />
              {clockedIn ? 'Clocked in' : 'Not clocked in'}
            </div>
            <Link
              href="/recipient/attendance"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E6C66A] to-[#B8901F] px-6 py-3 text-sm font-bold text-[#531010] shadow-md hover:brightness-105 transition"
            >
              <Clock className="h-4 w-4" />
              {clockedIn ? 'Clock Out' : 'Clock In'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {assignment && (
              <p className="text-center text-[11px] text-white/55 sm:text-right">
                {assignment.academic_year} · {assignment.semester} · {assignment.required_hours}h required
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Service hours */}
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-semibold text-[#1E293B]">Service Hours Progress</h2>
            {summary && <span className="text-xs text-[#8A6A6A]">{assignment?.office?.name ?? 'This semester'}</span>}
          </div>

          {isLoading ? (
            <div className="mt-4 h-44 animate-pulse rounded-xl bg-[#EAD9D9]" />
          ) : summary ? (
            <>
              <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
                <HoursRing verified={summary.verified} pending={summary.pending} required={summary.required} />
                <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-1">
                  <LegendRow color="#27AE60" label="Verified Hours" value={formatHours(summary.verified)} valueColor="text-[#27AE60]" />
                  <LegendRow color="#F39C12" label="Pending Verification" value={formatHours(summary.pending)} />
                  <LegendRow color="#CBB8B8" label="Remaining Needed" value={formatHours(summary.remaining)} valueColor="text-[#7D1A1A]" />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-[#8A6A6A]">Overall completion</span>
                  <span className="font-semibold text-[#27AE60]">{formatPercent(summary.verified, summary.required)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EFE7E7]">
                  <div
                    className="h-full rounded-full bg-[#27AE60] transition-all duration-500"
                    style={{ width: `${Math.max(toPercent(summary.verified, summary.required), summary.verified > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-[#B09A9A]">No assignment found.</p>
          )}
        </div>

        {/* Quick actions + tip */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-[#1E293B]">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-xl border border-[#F0E5E5] bg-[#FAF7F7] p-3.5 transition-colors hover:border-[#EAD9D9] hover:bg-[#FEF0F0]"
                >
                  <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEF0F0] group-hover:bg-white">
                    <Icon className="h-5 w-5 text-[#7D1A1A]" />
                  </div>
                  <p className="text-sm font-bold text-[#1E293B]">{label}</p>
                  <p className="text-[11px] text-[#8A6A6A]">{sub}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Next-step tip */}
          {summary && (
            done ? (
              <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                <PartyPopper className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#27AE60]" />
                <div>
                  <p className="text-sm font-bold text-[#166534]">All hours completed!</p>
                  <p className="mt-0.5 text-xs text-[#166534]/80">You&apos;ve met your required service hours for this semester.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-[#F3E2B8] bg-[#FFFBEB] p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#B8901F]" />
                <div>
                  <p className="text-sm font-bold text-[#92400E]">Next step</p>
                  <p className="mt-0.5 text-xs text-[#92400E]/85">
                    You have <span className="font-semibold">{formatHours(summary.remaining)}</span> to go — clock in at your office to keep earning hours.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
