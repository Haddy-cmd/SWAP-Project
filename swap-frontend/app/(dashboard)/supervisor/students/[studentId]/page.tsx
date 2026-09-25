'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft, ReceiptText, Building2, Mail, CalendarDays, Flag, BadgeCheck,
  History, TrendingUp, Clock, AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { PACE_META, UNKNOWN_PACE, paceDetail, type PaceStatus } from '@/lib/utils/pace'
import type { TimeLog } from '@/types/attendance.types'

const PACE_ICON: Record<PaceStatus, LucideIcon> = {
  complete: CheckCircle2,
  on_track: TrendingUp,
  behind: AlertTriangle,
  not_started: Clock,
}

const fmtHrs = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))

/** Human summary of the student's most recent attendance activity. */
function lastActivity(log?: TimeLog): string {
  if (!log) return 'No activity yet'
  const when = format(new Date(log.date + 'T00:00:00'), 'MMM d, yyyy')
  const what =
    log.status === 'open' ? 'Clocked in — session in progress'
      : log.status === 'verified' ? 'Hours verified'
      : log.status === 'rejected' ? 'Log rejected'
      : log.is_manual ? 'Bonus hours credited'
      : 'Session logged — awaiting verification'
  return `${when} · ${what}`
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()

  const { data: result, isLoading } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: () => attendanceApi.getStudentSummary(Number(studentId)),
    enabled: !!studentId,
  })

  // Just the newest log, for the "Last Activity" detail.
  const { data: logsPage } = useQuery({
    queryKey: ['student-logs', studentId, 'latest'],
    queryFn: () => attendanceApi.getStudentLogs(Number(studentId), { per_page: '1' }),
    enabled: !!studentId,
  })

  const summary = result?.data
  const student = result?.student
  const name = student?.name ?? `Student #${studentId}`

  const required = summary?.required ?? student?.required_hours ?? 0
  const verified = summary?.verified ?? 0
  const pending = summary?.pending ?? 0
  const remaining = summary?.remaining ?? Math.max(0, required - verified)
  const pct = required > 0 ? Math.min(100, (verified / required) * 100) : 0

  // Pace is decided server-side against the elapsed term, so this page and the
  // supervisor's at-risk panel can never disagree about who is behind.
  const pace = student?.pace ?? UNKNOWN_PACE
  const paceMeta = PACE_META[pace.status]
  const PaceIcon = PACE_ICON[pace.status]

  const note =
    verified <= 0
      ? `No verified hours yet this period — ${fmtHrs(required)} hours required to complete the placement.`
      : remaining <= 0
        ? `Requirement complete — all ${fmtHrs(required)} hours have been verified.`
        : pace.status === 'behind' && pace.expected_hours != null
          ? `${paceDetail(pace)} — about ${fmtHrs(pace.expected_hours)} of the ${fmtHrs(required)} required hours should be verified by now.`
          : `${fmtHrs(remaining)} verified hours remaining to complete the ${fmtHrs(required)}-hour requirement.`

  const details: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: Building2, label: 'Office', value: student?.office ?? '—' },
    { Icon: Mail, label: 'Email', value: student?.email ?? '—' },
    { Icon: CalendarDays, label: 'Period', value: [student?.academic_year, student?.semester].filter(Boolean).join(' · ') || '—' },
    { Icon: Flag, label: 'Required Hours', value: required ? `${fmtHrs(required)} hours` : '—' },
    { Icon: BadgeCheck, label: 'Student ID', value: student?.student_id_number ?? '—' },
    { Icon: History, label: 'Last Activity', value: lastActivity(logsPage?.data?.[0]) },
  ]

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[940px] space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-64 animate-pulse rounded-[18px] bg-ink-200/60" />
        <div className="h-40 animate-pulse rounded-[18px] bg-ink-200/60" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[940px]">
      <Link href="/supervisor/students"
        className="mb-4 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-brand-700 transition-colors">
        <ArrowLeft className="h-[19px] w-[19px]" /> Back to students
      </Link>

      {/* header */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} avatarUrl={student?.avatar_url}
            className="h-[69px] w-[88px] flex-none rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 font-serif text-[22px] font-semibold text-gold-300" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Service Hours Overview</p>
            <h1 className="mt-1 font-serif text-[31px] font-medium leading-none text-ink-950">{name}</h1>
            <p className="mt-1.5 text-[13px] text-ink-500">
              {student?.office ? `${student.office} · ` : ''}Service hours overview
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3.5 py-[7px] text-[12px] font-bold text-success-800">
            <span className="h-[7px] w-[7px] rounded-full bg-success-600" /> Active recipient
          </span>
          <Link href={`/supervisor/students/${studentId}/duty-slip`}
            className="flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-[18px] text-[13.5px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors">
            <FileText className="h-[19px] w-[19px]" /> Duty Slip
          </Link>
          <Link href={`/supervisor/students/${studentId}/logs`}
            className="flex h-11 items-center gap-2 rounded-xl px-[18px] text-[13.5px] font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,.24)]"
            style={{ background: 'linear-gradient(180deg,#2A7148,#16452B)' }}>
            <ReceiptText className="h-[19px] w-[19px]" /> View Attendance Logs
          </Link>
        </div>
      </div>

      {/* progress hero */}
      <div className="rounded-[18px] border border-ink-200 bg-white px-7 py-[26px] shadow-[0_2px_10px_rgba(19,36,26,.05)]">
        <div className="flex flex-wrap items-center gap-x-[34px] gap-y-6">
          {/* ring */}
          <div className="flex flex-none flex-col items-center gap-3">
            <div className="flex h-[212px] w-[212px] items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#1F5B3A 0 ${pct}%, #ECEFE2 ${pct}% 100%)` }}>
              <div className="flex h-[154px] w-[154px] flex-col items-center justify-center rounded-full bg-white">
                <span className="font-serif text-[44px] font-semibold leading-none tabular-nums text-ink-950">{fmtHrs(verified)}</span>
                <span className="mt-1 text-[12.5px] text-ink-500">of {fmtHrs(required)} hrs</span>
                <span className="mt-2 rounded-full bg-brand-100 px-2.5 py-[3px] text-[11px] font-bold text-brand-700">
                  {Math.round(pct)}% complete
                </span>
              </div>
            </div>
            <p className="text-[11.5px] text-ink-400">{fmtHrs(verified)} verified hours logged this period</p>
          </div>

          {/* breakdown */}
          <div className="min-w-[280px] flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Hours Breakdown</span>
              <span title={paceDetail(pace)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ color: paceMeta.color, background: paceMeta.bg }}>
                <PaceIcon className="h-[15px] w-[15px]" /> {paceMeta.label}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ['Verified', verified, '#1F8163', '#145643', '#82CBB0', '#EFF8F4', '#DCF1E8'],
                ['Pending', pending, '#F59E0B', '#B45309', '#FBBF24', '#FFFBEB', '#FDE68A'],
                ['Remaining', remaining, '#1F5B3A', '#1F5B3A', '#9FC0A8', '#F7F6EE', '#DCE0CF'],
              ] as const).map(([label, val, dot, color, unit, bg, border]) => (
                <div key={label} className="rounded-[13px] px-4 py-[15px]" style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                    <span className="text-[11.5px] font-bold" style={{ color }}>{label}</span>
                  </div>
                  <div className="font-serif text-[27px] font-semibold leading-none tabular-nums" style={{ color }}>
                    {fmtHrs(val)}<span className="text-[15px]" style={{ color: unit }}>h</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-[11px] bg-ink-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-500">
              <Flag className="h-[17px] w-[17px] flex-none text-gold-600" /> {note}
            </div>
          </div>
        </div>
      </div>

      {/* placement details */}
      <div className="mt-[18px] rounded-[18px] border border-ink-200 bg-white px-7 py-[22px] shadow-[0_2px_10px_rgba(19,36,26,.05)]">
        <div className="mb-[18px] text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Placement Details</div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {details.map((d) => (
            <div key={d.label} className="flex items-start gap-3">
              <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] border border-ink-200 bg-ink-50 text-brand-700">
                <d.Icon className="h-[19px] w-[19px]" />
              </span>
              <div className="min-w-0">
                <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{d.label}</div>
                <div className="break-words text-sm font-semibold text-ink-950">{d.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
