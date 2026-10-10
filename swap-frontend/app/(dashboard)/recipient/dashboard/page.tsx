'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Check, Circle, Clock, Gauge, History, LogIn, LogOut, MapPin, QrCode, UserRound, XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatHours } from '@/lib/utils/formatHours'
import { formatDate } from '@/lib/utils/formatDate'
import { TermEndedBanner } from '@/components/attendance/TermEndedBanner'
import { TermReportDueBanner } from '@/components/attendance/TermReportDueBanner'
import type { RecipientProgress, TimeLog } from '@/types/attendance.types'

const TZ = 'Asia/Manila'
const HERO_BG = 'radial-gradient(110% 150% at 100% 0%, rgba(221,187,56,.26), transparent 45%), radial-gradient(90% 120% at 0% 100%, rgba(47,165,124,.30), transparent 55%), linear-gradient(120deg,#0B5234 0%,#063D27 55%,#08301F 100%)'
const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-white px-6 py-[22px] shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const LINK = 'text-[13px] font-semibold text-[#17815F] hover:text-[#0F6A4D]'

/** "GOOD MORNING/AFTERNOON/EVENING" by the Manila clock. */
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Recipient → Dashboard ("SWAP Recipient Dashboard v6"): a hero with the student's placement and a
 * clock panel (status, live shift timer, Clock in/out → Attendance), the service-hours card with a
 * pace note, the "before your stipend is released" steps, and the last five sessions.
 */
export default function RecipientDashboard() {
  const { user } = useAuthStore()
  const { data: summary, isLoading } = useQuery({ queryKey: ['hours-summary'], queryFn: () => attendanceApi.getHoursSummary() })
  const { data: currentLog } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: (query) => (query.state.data ? 20_000 : false),
  })
  const { data: assignment } = useQuery({ queryKey: ['recipient-assignment'], queryFn: () => attendanceApi.getMyAssignment() })
  const { data: progress } = useQuery({ queryKey: ['recipient-progress'], queryFn: () => attendanceApi.getProgress() })
  const { data: recent } = useQuery({ queryKey: ['my-logs', 'recent'], queryFn: () => attendanceApi.getMyLogs({ per_page: '5' }) })

  const done = !!summary && summary.required > 0 && summary.remaining <= 0
  const office = assignment?.office?.name

  return (
    <div className="space-y-5 text-ink-950">
      {/* Hero: placement + clock panel */}
      <section className="relative grid items-center gap-5 overflow-hidden rounded-[20px] px-7 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]" style={{ background: HERO_BG }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dsa-logo.png" alt="" aria-hidden className="pointer-events-none absolute right-[23%] top-1/2 hidden h-[170%] -translate-y-1/2 opacity-[.14] lg:block" style={{ filter: 'grayscale(1) brightness(2.4)' }} />
        <div className="relative min-w-0">
          <p className="text-[11.5px] font-extrabold tracking-[0.16em] text-[#DDBB38]">{greeting()}</p>
          <h1 className="mb-3 mt-1 text-[24px] font-extrabold leading-tight text-white [text-wrap:pretty]">{user?.name ?? 'Welcome'}</h1>
          {assignment ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip Icon={Building2}>{office ?? 'Office'}</Chip>
                {assignment.office?.location && <Chip Icon={MapPin}>{assignment.office.location}</Chip>}
                {assignment.supervisor?.name && <Chip Icon={UserRound}>Supervisor: {assignment.supervisor.name}</Chip>}
              </div>
              <p className="mt-2.5 text-[12.5px] text-white/70">
                {assignment.semester} {assignment.academic_year} · {assignment.required_hours}h required
                {!!assignment.carried_over_hours && ` (incl. ${assignment.carried_over_hours}h carried over)`}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-white/75">No office assignment yet. The DSA will notify you once you&apos;re placed.</p>
          )}
        </div>
        <ClockPanel timeIn={currentLog?.time_in ?? null} office={office} placed={!!assignment} />
      </section>

      {/* The current term has ended: Qualified, or Deficient and what to do */}
      {assignment && <TermEndedBanner assignment={assignment} />}
      {/* Hours met or term ended, and the end-of-term report isn't in yet */}
      {assignment && <TermReportDueBanner assignment={assignment} hoursMet={done} />}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Service hours */}
        <section className={`${CARD} flex flex-col gap-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15.5px] font-bold">Service hours</p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">{summary ? `Your progress toward ${formatHours(summary.required)}` : 'Your progress this term'}</p>
            </div>
            <Link href="/recipient/hours" className={LINK}>View all logs</Link>
          </div>
          {isLoading ? (
            <div className="h-[156px] animate-pulse rounded-xl bg-ink-100" />
          ) : summary ? (
            <div className="flex flex-wrap items-center gap-7">
              <Ring verified={summary.verified} pending={summary.pending} required={summary.required} />
              <div className="flex min-w-[180px] flex-1 flex-col">
                <HoursRow color="#17815F" label="Verified" value={formatHours(summary.verified)} />
                <HoursRow color="#DDBB38" label="Waiting for supervisor" value={formatHours(summary.pending)} />
                <HoursRow color="#E3E7E2" label="Still needed" value={formatHours(summary.remaining)} last />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-500">Your hours appear here once you&apos;re placed in an office.</p>
          )}
          {progress && <PaceNote progress={progress} />}
        </section>

        {/* Before your stipend is released */}
        {progress ? <StipendSteps checklist={progress.checklist} /> : <section className={`${CARD} h-[260px] animate-pulse`} />}
      </div>

      {/* Recent sessions */}
      <section className={CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15.5px] font-bold">Recent sessions</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">Your last 5 clock-ins</p>
          </div>
          <Link href="/recipient/hours" className={LINK}>See all hours</Link>
        </div>
        <RecentSessions logs={recent?.data} office={office} />
      </section>
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Chip({ Icon, children }: { Icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[.16] bg-white/10 px-[11px] py-1.5 text-[12.5px] font-semibold text-white">
      <Icon className="h-4 w-4 text-[#DDBB38]" /> {children}
    </span>
  )
}

/** Status, today's date, a live shift timer while clocked in, and Clock in/out (done on Attendance). */
function ClockPanel({ timeIn, office, placed }: { timeIn: string | null; office?: string; placed: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timeIn) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timeIn])

  const secs = timeIn ? Math.max(0, Math.floor((now - new Date(timeIn).getTime()) / 1000)) : 0
  const timer = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`
  const today = new Date().toLocaleDateString('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="relative z-[2] flex w-full flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,.18)]">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-[7px] text-[12.5px] font-bold ${timeIn ? 'text-[#0B5234]' : 'text-[#5B6B62]'}`}>
          <span className={`h-2 w-2 rounded-full ${timeIn ? 'animate-pulse bg-[#2FA57C]' : 'bg-[#B5BDB7]'}`} />
          {timeIn ? 'Clocked in' : 'Not clocked in'}
        </span>
        <span className="text-xs text-ink-500">{today}</span>
      </div>
      <div>
        <p className="text-[26px] font-extrabold leading-none tracking-[-.01em] tabular-nums" aria-label={timeIn ? 'Time on this shift' : undefined}>{timer}</p>
        <p className="mt-1 text-xs text-ink-500">
          {timeIn ? `Started at ${timeOf(timeIn)}${office ? ` · ${office}` : ''}` : placed ? 'Clock in when your shift starts' : 'Available once you’re placed in an office'}
        </p>
      </div>
      {timeIn ? (
        <Link href="/recipient/attendance"
          className="flex h-10 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#C8322B] bg-white text-sm font-bold text-[#A3201F] hover:bg-danger-50">
          <LogOut className="h-[18px] w-[18px]" /> Clock out
        </Link>
      ) : placed ? (
        <Link href="/recipient/attendance"
          className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#2B2200] shadow-[0_2px_8px_rgba(212,175,42,.35)] hover:brightness-105"
          style={{ background: 'linear-gradient(180deg,#E6C649,#D4AF2A)' }}>
          <LogIn className="h-[18px] w-[18px]" /> Clock in
        </Link>
      ) : (
        <span className="flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-ink-100 text-sm font-bold text-ink-400">
          <LogIn className="h-[18px] w-[18px]" /> Clock in
        </span>
      )}
      {placed && (
        <Link href="/recipient/attendance/scan" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#17815F] hover:text-[#0F6A4D]">
          <QrCode className="h-4 w-4" /> Or scan your office QR code
        </Link>
      )}
    </div>
  )
}

// ── Service hours ───────────────────────────────────────────────────────────

function Ring({ verified, pending, required }: { verified: number; pending: number; required: number }) {
  const v = required > 0 ? Math.min(verified / required, 1) : 0
  const p = required > 0 ? Math.min(pending / required, 1 - v) : 0
  const pct = Math.round(v * 100)
  return (
    <div role="img" aria-label={`${pct}% complete`} className="relative h-[156px] w-[156px] flex-none rounded-full"
      style={{ background: `conic-gradient(#17815F 0deg ${v * 360}deg, #DDBB38 ${v * 360}deg ${(v + p) * 360}deg, #EEF1EC ${(v + p) * 360}deg 360deg)` }}>
      <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-[32px] font-extrabold leading-none">{pct}%</span>
        <span className="mt-1 text-xs text-ink-500">complete</span>
      </div>
    </div>
  )
}

function HoursRow({ color, label, value, last = false }: { color: string; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${last ? '' : 'border-b border-[#F0F1EC]'}`}>
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      <span className="flex-1 text-[13.5px] text-ink-600">{label}</span>
      <strong className="text-[17px]">{value}</strong>
    </div>
  )
}

/** One sentence on pace: on track or behind, what each week needs, and the likely finish. */
function PaceNote({ progress }: { progress: RecipientProgress }) {
  const { pace, forecast: f, end_date } = progress
  const good = pace.status === 'on_track' || pace.status === 'complete' || f.outstanding_hours <= 0
  let text: string
  if (f.outstanding_hours <= 0) {
    text = `Your required hours are covered${progress.breakdown.pending_hours > 0 ? ' once your waiting hours are verified' : ''}. Great work!`
  } else if (f.hours_per_week_needed == null) {
    text = end_date ? `The term ended on ${formatDate(end_date)} with ${formatHours(f.outstanding_hours)} still to go.` : `${formatHours(f.outstanding_hours)} still to go.`
  } else {
    const need = `you need about ${f.hours_per_week_needed}h a week to finish by ${end_date ? formatDate(end_date) : 'the end of the term'}`
    text = f.recent_weekly_average > 0
      ? `${pace.status === 'behind' ? 'You’re behind pace' : 'You’re on track'}. You average ${f.recent_weekly_average}h a week, and ${need}.`
      : `Aim for about ${f.hours_per_week_needed}h a week to finish ${formatHours(f.outstanding_hours)} by ${end_date ? formatDate(end_date) : 'the end of the term'}.`
  }
  return (
    <div className={`flex items-center gap-3 rounded-[14px] px-4 py-3.5 ${good ? 'bg-[#EEF6F1]' : 'bg-[#FFF8DD]'}`}>
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-white ${good ? 'text-[#17815F]' : 'text-[#8A6A00]'}`}><Gauge className="h-5 w-5" /></span>
      <p className="text-[13px] leading-relaxed text-[#2C3A32] [text-wrap:pretty]">{text}</p>
    </div>
  )
}

// ── Stipend steps ───────────────────────────────────────────────────────────

const STEP_HINT: Record<string, string> = {
  hours: 'Verified by your supervisor',
  signature: 'Signs your stipend stub',
  report: 'Due at the end of the term',
  stipend: 'Happens after the steps above',
}

function ctaFor(item: RecipientProgress['checklist'][number]): string | null {
  if (item.state === 'done' || !item.link) return null
  if (item.key === 'hours') return /promissory/i.test(item.label) ? 'File note' : 'Clock in'
  if (item.key === 'signature') return 'Save'
  if (item.key === 'report') return item.state === 'todo' ? 'Submit' : 'View'
  return null
}

function StipendSteps({ checklist }: { checklist: RecipientProgress['checklist'] }) {
  const doneCount = checklist.filter((i) => i.state === 'done').length
  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15.5px] font-bold">Before your stipend is released</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Finish these steps this semester</p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-[#DFF0E7] px-2.5 py-1 text-[12.5px] font-bold text-[#0B5234]">{doneCount} of {checklist.length} done</span>
      </div>
      <div className="h-1.5 rounded-md bg-[#EEF1EC]">
        <div className="h-full rounded-md" style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#2FA57C,#17815F)' }} />
      </div>
      <ul>
        {checklist.map((item, i) => {
          const isDone = item.state === 'done'
          const style = isDone ? { bg: '#DFF0E7', fg: '#0B5234', Icon: Check }
            : item.state === 'waiting' ? { bg: '#FBF1C7', fg: '#7A5E00', Icon: Clock }
            : item.state === 'blocked' ? { bg: '#F6E1E0', fg: '#A3201F', Icon: XCircle }
            : { bg: '#F6E1E0', fg: '#A3201F', Icon: Circle }
          const cta = ctaFor(item)
          return (
            <li key={item.key} className={`flex items-center gap-3.5 py-[13px] ${i < checklist.length - 1 ? 'border-b border-[#F0F1EC]' : ''}`}>
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: style.bg, color: style.fg }}><style.Icon className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-semibold ${isDone ? 'text-ink-500' : 'text-ink-950'}`}>{item.label}</p>
                <p className="mt-px text-[12.5px] text-ink-500">{STEP_HINT[item.key] ?? ''}</p>
              </div>
              {cta && item.link && <Link href={item.link} className={`flex-none ${LINK}`}>{cta}</Link>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Recent sessions ─────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  verified: { label: 'Verified', fg: '#0B5234', bg: '#DFF0E7' },
  pending_verification: { label: 'Pending', fg: '#7A5E00', bg: '#FBF1C7' },
  rejected: { label: 'Rejected', fg: '#A3201F', bg: '#F6E1E0' },
  open: { label: 'In progress', fg: '#2E5C8A', bg: '#E3ECF6' },
}

function RecentSessions({ logs, office }: { logs?: TimeLog[]; office?: string }) {
  if (!logs) return <div className="mt-4 h-40 animate-pulse rounded-xl bg-ink-100" />
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 pb-3.5 pt-7 text-center">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#F1F3EE] text-[#17815F]"><History className="h-6 w-6" /></span>
        <p className="mt-1 text-[14.5px] font-bold">No sessions yet</p>
        <p className="max-w-[380px] text-[13px] text-ink-500 [text-wrap:pretty]">
          When you start your shift{office ? ` at ${office}` : ''}, press Clock in. Your hours will show up here.
        </p>
      </div>
    )
  }
  const row = 'grid grid-cols-[1.3fr_1.4fr_0.8fr_0.9fr] items-center gap-3 px-3.5'
  return (
    <div className="mt-3.5 overflow-x-auto">
      <div className="min-w-[520px]">
        <div className={`${row} rounded-[10px] bg-[#F6F7F3] py-2.5 text-xs font-bold text-ink-500`}><span>Date</span><span>Time</span><span>Hours</span><span>Status</span></div>
        {logs.slice(0, 5).map((l) => {
          const s = STATUS[l.status] ?? STATUS.open
          const date = new Date(`${String(l.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={l.id} className={`${row} border-b border-[#F0F1EC] py-[13px] text-[13.5px] last:border-0`}>
              <span className="font-semibold">{date}</span>
              <span className="text-ink-600">{timeOf(l.time_in)} – {l.time_out ? timeOf(l.time_out) : 'now'}</span>
              <strong>{l.duration_hours != null ? `${Number(l.duration_hours).toFixed(1)}h` : '—'}</strong>
              <span><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: s.fg, background: s.bg }}>{s.label}</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
