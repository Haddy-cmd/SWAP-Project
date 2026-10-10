'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, BarChart3, Building2, Calendar, CalendarClock, CalendarRange, ChevronDown, Clock3, FilePenLine,
  FileText, RefreshCw, Users, Wallet, BadgeCheck, Timer, MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import { semestersApi } from '@/lib/api/semesters.api'
import { settingsApi } from '@/lib/api/settings.api'
import { useAuthStore } from '@/lib/store/authStore'
import { formatDay } from '@/lib/utils/semester'
import { TopbarSlot } from '@/components/layout/TopbarSlot'

const FALLBACK_YEAR = '2024-2025'
const FALLBACK_SEM = '1st Semester'

const GREEN = '#17815F'
const GOLD = '#DDBB38'
const RED = '#C8322B'

const periodKey = (year: string, sem: string) => `${year}__${sem}`
const shortSem = (sem: string) => sem.replace(' Semester', ' Sem')
const shortYear = (ay: string) => ay.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1–$2')

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-white shadow-[0_1px_3px_rgba(20,40,30,.05)]'

/** "Good morning/afternoon/evening" by the Manila clock. */
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** Whole days between two YYYY-MM-DD dates. */
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/**
 * Admin → Dashboard (layout "SWAP Admin Dashboard v2"): a welcome banner with today's tasks, the
 * semester's progress and quick actions; three action cards (applications to review, stipends
 * to release, program status) and three KPIs. The graphs live in Analytics & Reports. The
 * semester picker (in the top bar) picks the term the numbers show.
 */
export default function AdminDashboard() {
  const { user } = useAuthStore()
  const { data: periods = [] } = useQuery({ queryKey: ['admin-periods'], queryFn: () => analyticsApi.getPeriods() })
  const [selected, setSelected] = useState<string | null>(null)

  // Default to the most recent period with data once the list loads.
  useEffect(() => {
    if (!selected && periods.length) setSelected(periodKey(periods[0].academic_year, periods[0].semester))
  }, [periods, selected])

  const [year, sem] = (selected ?? periodKey(FALLBACK_YEAR, FALLBACK_SEM)).split('__')

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview', year, sem],
    queryFn: () => analyticsApi.getAdminOverview(year, sem),
  })
  const { data: calendar } = useQuery({ queryKey: ['semester-current'], queryFn: () => semestersApi.current() })
  const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: () => settingsApi.getSettings() })


  const stipendReady = overview?.stipend_summary?.ready_to_release ?? 0

  return (
    <div className="space-y-5 text-ink-950">
      <h1 className="sr-only">Admin Dashboard</h1>

      {/* The term every number and graph shows: in the top bar, beside the bell. */}
      <TopbarSlot>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#17815F]" />
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <select aria-label="Semester" value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} disabled={!periods.length}
            className="h-[38px] max-w-[150px] cursor-pointer appearance-none truncate rounded-[10px] border border-ink-900/15 bg-white pl-9 pr-8 text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-ink-50 focus:border-brand-700 focus:outline-none disabled:opacity-50 sm:max-w-none sm:text-[13px]">
            {periods.length === 0 && <option value="">{shortSem(FALLBACK_SEM)} {shortYear(FALLBACK_YEAR)}</option>}
            {periods.map((p) => (
              <option key={periodKey(p.academic_year, p.semester)} value={periodKey(p.academic_year, p.semester)}>
                {shortSem(p.semester)} {shortYear(p.academic_year)}
              </option>
            ))}
          </select>
        </div>
      </TopbarSlot>

      {/* Welcome banner */}
      <section className="relative grid gap-8 overflow-hidden rounded-[20px] px-7 py-7 lg:grid-cols-[1fr_auto] lg:items-center"
        style={{ background: 'radial-gradient(110% 150% at 100% 0%, rgba(221,187,56,.28), transparent 45%), radial-gradient(90% 120% at 0% 100%, rgba(47,165,124,.30), transparent 55%), linear-gradient(120deg,#0B5234 0%,#063D27 55%,#08301F 100%)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dsa-logo.png" alt="" aria-hidden className="pointer-events-none absolute right-[14%] top-1/2 hidden h-[200%] -translate-y-1/2 opacity-[.11] lg:block" style={{ filter: 'grayscale(1) brightness(2.4)' }} />
        <div className="relative">
          <p className="text-[11.5px] font-extrabold tracking-[0.16em] text-[#DDBB38]">{greeting().toUpperCase()}</p>
          <p className="mb-1.5 mt-1 text-[28px] font-extrabold text-white">Welcome back, {user?.name ?? 'Admin'}</p>
          <TodayTasks tasks={overview?.tasks} loading={isLoading} />
          <SemesterProgress calendar={calendar} />
        </div>
        <div className="relative grid grid-cols-3 gap-2.5 sm:w-[344px]">
          {[
            { href: '/admin/interviews', label: 'Schedule interviews', Icon: CalendarClock, bg: GOLD, fg: '#2B2200' },
            { href: '/admin/offices', label: 'Manage offices', Icon: Building2, bg: '#2FA57C', fg: '#FFFFFF' },
            { href: '/admin/analytics', label: 'Export report', Icon: BarChart3, bg: 'rgba(255,255,255,.9)', fg: '#063D27' },
          ].map(({ href, label, Icon, bg, fg }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-white/[.14] bg-white/[.08] px-2 pb-3.5 pt-4 text-center text-white transition-colors hover:bg-white/[.16]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg, color: fg }}><Icon className="h-5 w-5" /></span>
              <span className="text-xs font-semibold leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Action cards */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_0.85fr]">
        <div className={`${CARD} flex flex-col gap-4 p-[22px]`}>
          <CardHead icon={<FileText className="h-[22px] w-[22px]" />} iconBg="#FBF1C7" iconFg="#7A5E00"
            title="Applications to review" sub={`${overview?.total_applicants ?? 0} received this semester`} />
          <BigNumber value={overview?.pending ?? 0} text="waiting for your decision" />
          <div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-md bg-ink-100">
              {[[overview?.approved ?? 0, GREEN], [overview?.pending ?? 0, GOLD], [overview?.rejected ?? 0, RED]].map(([n, c], i) =>
                Number(n) > 0 && <div key={i} style={{ flex: Number(n), background: String(c) }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
              <Dot color={GREEN}>{overview?.approved ?? 0} approved</Dot>
              <Dot color={GOLD}>{overview?.pending ?? 0} pending</Dot>
              <Dot color={RED}>{overview?.rejected ?? 0} not approved</Dot>
            </div>
          </div>
          <Link href="/admin/applications"
            className="mt-auto flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#2B2200] shadow-[0_2px_8px_rgba(212,175,42,.3)]"
            style={{ background: 'linear-gradient(180deg,#E6C649,#D4AF2A)' }}>
            Start reviewing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className={`${CARD} flex flex-col gap-4 p-[22px]`}>
          <CardHead icon={<Wallet className="h-[22px] w-[22px]" />} iconBg="#DFF0E7" iconFg="#0B5234"
            title="Stipends to release" sub="Hours completed and verified" />
          <BigNumber value={stipendReady} text={stipendReady === 1 ? 'recipient is ready to be paid' : 'recipients are ready to be paid'} />
          <p className="flex-1 text-[12.5px] leading-relaxed text-ink-500">
            Signature and end-of-term report are in. Release them all at once or one by one.
          </p>
          <Link href="/admin/stipend"
            className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-[0_2px_8px_rgba(23,129,95,.25)]"
            style={{ background: GREEN }}>
            Release stipends <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className={`${CARD} flex flex-col gap-4 p-[22px]`}>
          <CardHead icon={<RefreshCw className="h-[22px] w-[22px]" />} iconBg="#EEF0EC" iconFg="#35483D"
            title="Program status" sub="What students can do right now" />
          <div className="flex flex-col">
            <StatusRow href="/admin/applications" Icon={FilePenLine} label="New applications"
              badge={settings ? (settings.applications_open ? 'Open' : 'Closed') : '…'} open={!!settings?.applications_open} />
            <StatusRow href="/admin/semesters" Icon={RefreshCw} label={calendar?.renewal ? `Renewal · ${shortSem(calendar.renewal.semester)}` : 'Renewal'}
              badge={calendar ? (calendar.renewal ? 'Open' : 'Closed') : '…'} open={!!calendar?.renewal} />
            <StatusRow href="/admin/semesters" Icon={CalendarRange} label="Current semester" last
              badge={!calendar ? '…' : calendar.current ? `${calendar.current.days_left ?? 0} days left` : calendar.next ? `Starts ${formatDay(calendar.next.start_date)}` : 'None'}
              open={!!calendar?.current} />
          </div>
          <p className="mt-auto text-xs leading-relaxed text-ink-500">Click a row to change it on its own page.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi href="/admin/assignments" Icon={Users} bg="#DFF0E7" fg="#0B5234" value={overview?.active_recipients ?? '—'} label="Active recipients" hint="currently serving" />
        <Kpi href="/admin/analytics" Icon={BadgeCheck} bg="#E3ECF6" fg="#2E5C8A" value={overview ? `${Math.round(overview.total_verified_hours)}h` : '—'} label="Verified hours" hint="logged this semester" />
        <Kpi href="/admin/analytics" Icon={Timer} bg="#F6E1E0" fg="#A3201F" value={overview ? `${overview.avg_completion_rate}%` : '—'} label="Avg. completion" hint="of required hours" />
      </div>

      {/* The graphs live in Analytics & Reports. */}
      <div className="flex justify-end">
        <Link href="/admin/analytics" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#17815F] hover:text-[#0F6A4D]">
          See graphs and reports in Analytics &amp; Reports <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ── Banner ──────────────────────────────────────────────────────────────────

function SemesterProgress({ calendar }: { calendar?: Awaited<ReturnType<typeof semestersApi.current>> }) {
  const term = calendar?.current
  if (!calendar) return <div className="mt-5 h-8 max-w-[440px] animate-pulse rounded bg-white/10" />
  if (!term) {
    return (
      <p className="mt-5 text-[12.5px] text-white/75">
        No current semester{calendar.next ? ` — the next starts ${formatDay(calendar.next.start_date)}` : ''}.{' '}
        <Link href="/admin/semesters" className="font-semibold text-[#DDBB38] hover:text-[#F0D468]">Open Semesters →</Link>
      </p>
    )
  }
  const total = Math.max(1, daysBetween(term.start_date, term.end_date) + 1)
  const day = Math.min(total, Math.max(1, total - (term.days_left ?? 0)))
  return (
    <div className="mt-5 flex max-w-[440px] items-center gap-3.5">
      <div className="flex-1">
        <div className="h-2 rounded-md bg-white/[.16]">
          <div className="h-full rounded-md" style={{ width: `${(day / total) * 100}%`, background: 'linear-gradient(90deg,#F0D468,#DDBB38)' }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px] text-white/65">
          <span>{formatDay(term.start_date)}</span><span>Day {day} of {total}</span><span>{formatDay(term.end_date)}</span>
        </div>
      </div>
      <span className="-mt-4 flex-none rounded-full px-3 py-1.5 text-[12.5px] font-bold text-[#2B2200]" style={{ background: GOLD }}>
        {term.days_left ?? 0} days left
      </span>
    </div>
  )
}

const TASK_ICON: Record<string, typeof Clock3> = {
  applications: FileText, renewals: RefreshCw, stipends: Wallet, interviews: CalendarClock, placements: Building2, concerns: MessageSquare,
}

// Short pill words (singular, plural); the full sentence from the API shows on hover.
const TASK_SHORT: Record<string, [string, string]> = {
  applications: ['to review', 'to review'], renewals: ['renewal', 'renewals'], stipends: ['stipend', 'stipends'],
  interviews: ['interview', 'interviews'], placements: ['to place', 'to place'], concerns: ['concern', 'concerns'],
}

/** "Today" — what is waiting for an admin, as short count pills linking to where it's done. */
function TodayTasks({ tasks, loading }: { tasks?: { key: string; count: number; label: string; href: string }[]; loading: boolean }) {
  if (loading && !tasks) {
    return <div className="flex gap-1.5">{[1, 2, 3].map((n) => <span key={n} className="h-7 w-24 animate-pulse rounded-full bg-white/10" />)}</div>
  }
  if (!tasks?.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-white/80">
        <CheckCircle2 className="h-4 w-4 text-[#DDBB38]" /> You&apos;re all caught up. Nothing needs you today.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Today</span>
      {tasks.map((t) => {
        const Icon = TASK_ICON[t.key] ?? Clock3
        const [one, many] = TASK_SHORT[t.key] ?? ['', '']
        return (
          <Link key={t.key} href={t.href} title={t.label} aria-label={t.label}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[.14] bg-white/[.08] px-2.5 text-xs text-white/85 transition-colors hover:bg-white/[.18] hover:text-white">
            <Icon className="h-[13px] w-[13px] text-[#DDBB38]" />
            <strong className="font-bold text-white">{t.count}</strong>
            {t.count === 1 ? one : many}
          </Link>
        )
      })}
    </div>
  )
}

// ── Cards ───────────────────────────────────────────────────────────────────

function CardHead({ icon, iconBg, iconFg, title, sub }: { icon: ReactNode; iconBg: string; iconFg: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[13px]" style={{ background: iconBg, color: iconFg }}>{icon}</span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-[12.5px] text-ink-500">{sub}</p>
      </div>
    </div>
  )
}

function BigNumber({ value, text }: { value: number; text: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[38px] font-extrabold leading-none">{value}</span>
      <span className="text-[13.5px] text-ink-600">{text}</span>
    </div>
  )
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{children}</span>
}

function StatusRow({ href, Icon, label, badge, open, last = false }: {
  href: string; Icon: typeof Clock3; label: string; badge: string; open: boolean; last?: boolean
}) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 py-[11px] text-ink-950 hover:text-[#17815F] ${last ? '' : 'border-b border-ink-100'}`}>
      <Icon className="h-[18px] w-[18px] text-ink-500" />
      <span className="flex-1 text-[13.5px] font-medium">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${open ? 'bg-[#DFF0E7] text-[#0B5234]' : 'bg-[#EEF0EC] text-[#5B6B62]'}`}>{badge}</span>
    </Link>
  )
}

function Kpi({ href, Icon, bg, fg, value, label, hint }: {
  href: string; Icon: typeof Clock3; bg: string; fg: string; value: ReactNode; label: string; hint: string
}) {
  return (
    <div className="rounded-2xl border border-ink-900/[.08] bg-white px-5 py-[18px] shadow-[0_1px_3px_rgba(20,40,30,.05)]">
      <div className="flex items-center justify-between">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px]" style={{ background: bg, color: fg }}><Icon className="h-5 w-5" /></span>
        <Link href={href} className="text-xs font-semibold text-[#17815F] hover:text-[#0F6A4D]">View</Link>
      </div>
      <p className="mt-3.5 text-[30px] font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[13px] font-semibold">{label}</p>
      <p className="text-xs text-ink-500">{hint}</p>
    </div>
  )
}
