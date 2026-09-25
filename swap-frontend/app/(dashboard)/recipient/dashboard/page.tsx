'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Clock, TrendingUp, FileText, Banknote, MapPin, UserRound, ArrowRight, Lightbulb, PartyPopper, Bot } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { AskChatbotButton } from '@/components/chatbot/AskChatbotButton'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatHours, formatPercent, toPercent } from '@/lib/utils/formatHours'

const ACTIONS = [
  { href: '/recipient/attendance', icon: Clock, label: 'Time In / Out', sub: 'Scan your QR code' },
  { href: '/recipient/hours', icon: TrendingUp, label: 'My Hours', sub: 'View all logs' },
  { href: '/recipient/reports/duty-slip', icon: FileText, label: 'Duty Slip', sub: 'Print & submit' },
  { href: '/recipient/stipend', icon: Banknote, label: 'Stipend', sub: 'Disbursement history' },
]

// Palette hexes for inline gradients (keep in sync with @theme in app/globals.css).
const C = {
  success700: '#196B53',
  success600: '#1F8163',
  success400: '#4FB08E',
  warning500: '#F59E0B',
  ink100: '#ECEFE2',
  ink300: '#CAD2BC',
}

// Deep seal-green card with a gold glow top-right and a green glow bottom-left.
const HERO_BG =
  'radial-gradient(120% 140% at 100% 0%, rgba(242,204,75,.22), transparent 45%), ' +
  'radial-gradient(90% 120% at 0% 100%, rgba(61,138,92,.30), transparent 55%), ' +
  'linear-gradient(120deg, #16452B 0%, #10331F 55%, #0B2716 100%)'

const CARD = 'rounded-2xl border border-ink-900/10 bg-white/90 shadow-[0_2px_8px_rgba(19,36,26,0.04)]'

/** Verified hours sweep green; pending verification continues in amber; the rest is track. */
function HoursRing({ verified, pending, required }: { verified: number; pending: number; required: number }) {
  const vFrac = required > 0 ? Math.min(verified / required, 1) : 0
  const pFrac = required > 0 ? Math.min(pending / required, Math.max(0, 1 - vFrac)) : 0
  const vDeg = vFrac * 360
  const pDeg = (vFrac + pFrac) * 360

  return (
    <div
      role="img"
      aria-label={`${formatHours(verified)} verified of ${formatHours(required)}`}
      className="relative h-[172px] w-[172px] flex-none rounded-full"
      style={{
        background: `conic-gradient(${C.success700} 0deg, ${C.success400} ${vDeg}deg, ${C.warning500} ${vDeg}deg ${pDeg}deg, ${C.ink100} ${pDeg}deg)`,
      }}
    >
      <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
        <p className="text-[30px] font-extrabold leading-none text-ink-900">{formatHours(verified)}</p>
        <p className="mb-[7px] mt-[5px] whitespace-nowrap text-xs text-ink-500">of {formatHours(required)}</p>
        <span className="rounded-full bg-success-50 px-[9px] py-[3px] text-[11px] font-bold text-success-600">
          {formatPercent(verified, required)}%
        </span>
      </div>
    </div>
  )
}

function LegendRow({ color, label, value, valueClass = 'text-ink-900' }: { color: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-3 h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} />
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className={`text-[19px] font-extrabold ${valueClass}`}>{value}</p>
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
  const pct = summary ? toPercent(summary.verified, summary.required) : 0

  return (
    <div className="space-y-6">
      {/* ── Welcome hero + assistant ── */}
      <div className="flex items-start gap-4">
        <section
          className="relative min-w-0 flex-1 overflow-hidden rounded-[18px] px-6 py-[26px] shadow-[0_2px_8px_rgba(19,36,26,0.08)]"
          style={{ background: HERO_BG }}
        >
          {/* Faded seal watermark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dsa-seal-watermark.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-[7%] top-1/2 h-[196%] w-auto -translate-y-1/2 opacity-[0.13] [filter:grayscale(1)_brightness(2.4)]"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex min-w-0 flex-[1_1_360px] items-center gap-[18px]">
              <UserAvatar
                name={user?.name}
                avatarUrl={user?.avatar_url}
                className="h-14 w-14 rounded-full bg-brand-100 text-xl font-extrabold text-brand-900"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-gold-400">WELCOME BACK</p>
                <h1 className="mb-1.5 mt-[3px] truncate text-2xl font-extrabold text-white">{user?.name}</h1>
                {assignment ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-white/80">
                    <strong className="font-semibold text-white">{assignment.office?.name ?? 'Office'}</strong>
                    {assignment.office?.location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-[15px] w-[15px]" />{assignment.office.location}</span>
                    )}
                    {assignment.supervisor?.name && (
                      <span className="inline-flex items-center gap-1"><UserRound className="h-[15px] w-[15px]" />{assignment.supervisor.name}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-white/75">No active office assignment yet.</p>
                )}
              </div>
            </div>

            <div className="relative flex flex-col items-start gap-3">
              <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                <span className={`h-[7px] w-[7px] rounded-full ${clockedIn ? 'animate-pulse bg-success-400' : 'bg-white/50'}`} />
                {clockedIn ? 'Clocked in' : 'Not clocked in'}
              </span>
              <Link
                href="/recipient/attendance"
                className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] px-5 text-sm font-bold transition hover:brightness-105 ${
                  clockedIn ? 'bg-white text-danger-700' : 'bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950'
                }`}
              >
                <Clock className="h-[19px] w-[19px]" />
                {clockedIn ? 'Clock Out' : 'Clock In'}
                <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
              {assignment && (
                <p className="text-[11.5px] text-white/60">
                  {assignment.academic_year} · {assignment.semester} · {assignment.required_hours}h required
                </p>
              )}
            </div>
          </div>
        </section>

        <AskChatbotButton
          label="Ask the SWAP Assistant"
          className="relative hidden h-14 w-14 flex-none items-center justify-center rounded-full bg-brand-900 shadow-[0_6px_16px_rgba(16,51,31,0.25)] transition-colors hover:bg-brand-800 sm:flex"
        >
          <Bot className="h-[26px] w-[26px] text-white" />
          <span className="absolute right-px top-px h-[11px] w-[11px] rounded-full border-2 border-ink-50 bg-success-400" />
        </AskChatbotButton>
      </div>

      {/* ── Main grid ── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Service hours */}
        <section className={`${CARD} px-6 pb-[26px] pt-[22px]`}>
          <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="whitespace-nowrap text-base font-bold text-ink-900">Service Hours Progress</h2>
            {assignment?.office?.name && <span className="whitespace-nowrap text-xs text-ink-500">{assignment.office.name}</span>}
          </div>

          {isLoading ? (
            <div className="h-[172px] animate-pulse rounded-xl bg-ink-100" />
          ) : summary ? (
            <>
              <div className="mb-[26px] flex flex-wrap items-center gap-10">
                <HoursRing verified={summary.verified} pending={summary.pending} required={summary.required} />
                <div className="flex flex-col gap-[18px]">
                  <LegendRow color={C.success600} label="Verified Hours" value={formatHours(summary.verified)} valueClass="text-success-600" />
                  <LegendRow color={C.warning500} label="Pending Verification" value={formatHours(summary.pending)} />
                  <LegendRow color={C.ink300} label="Remaining Needed" value={formatHours(summary.remaining)} />
                </div>
              </div>

              <div className="mb-[7px] flex justify-between text-xs text-ink-500">
                <span>Overall completion</span>
                <span className="font-bold text-ink-900">{formatPercent(summary.verified, summary.required)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-lg bg-ink-100">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, summary.verified > 0 ? 1.5 : 0)}%`,
                    background: `linear-gradient(90deg, ${C.success700}, ${C.success600} 55%, ${C.success400})`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-400">No assignment found.</p>
          )}
        </section>

        {/* Quick actions + status note */}
        <div className="flex flex-col gap-[18px]">
          <section className={`${CARD} px-5 pb-5 pt-[22px]`}>
            <h2 className="mb-4 text-base font-bold text-ink-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col gap-[22px] rounded-xl border border-ink-900/[0.08] bg-brand-50/50 px-4 py-[18px] text-ink-900 transition-colors hover:border-brand-600/40 hover:bg-brand-50"
                >
                  <Icon className="h-[22px] w-[22px] text-brand-600" />
                  <span className="leading-[1.35]">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-[11.5px] text-ink-500">{sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {summary && (
            done ? (
              <section
                className="flex items-start gap-3 rounded-[14px] border border-success-600/20 px-[18px] py-4"
                style={{ background: 'linear-gradient(110deg, rgba(220,241,232,.95), rgba(251,241,201,.8))' }}
              >
                <PartyPopper className="h-[22px] w-[22px] flex-none text-success-600" />
                <div>
                  <p className="text-sm font-bold text-brand-800">All hours completed!</p>
                  <p className="mt-[3px] text-[12.5px] text-ink-700">You&apos;ve met your required service hours for this semester.</p>
                </div>
              </section>
            ) : (
              <section
                className="flex items-start gap-3 rounded-[14px] border border-gold-500/25 px-[18px] py-4"
                style={{ background: 'linear-gradient(110deg, rgba(253,248,228,.95), rgba(241,246,241,.85))' }}
              >
                <Lightbulb className="h-[22px] w-[22px] flex-none text-gold-600" />
                <div>
                  <p className="text-sm font-bold text-brand-800">Next step</p>
                  <p className="mt-[3px] text-[12.5px] text-ink-700">
                    You have <span className="font-semibold">{formatHours(summary.remaining)}</span> to go — clock in at your office to keep earning hours.
                  </p>
                </div>
              </section>
            )
          )}
        </div>
      </div>
    </div>
  )
}
