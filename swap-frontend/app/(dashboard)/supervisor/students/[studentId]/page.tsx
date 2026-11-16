'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { BackLink } from '@/components/shared/BackLink'
import { format } from 'date-fns'
import {
  BadgeCheck, Building2, CalendarClock, CalendarDays, CircleAlert, FileText, Flag, History, Info, MoreHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { PACE_META, UNKNOWN_PACE } from '@/lib/utils/pace'
import { TermBadge } from '@/components/shared/TermBadge'
import { MarkDeficientModal } from '@/components/supervisor/MarkDeficientModal'
import { formatDay } from '@/lib/utils/semester'
import { formatDateTime } from '@/lib/utils/formatDate'
import { CARD, HoursCard, PACE_TONE, fmtHrs } from '@/components/supervisor/student/HoursCard'
import { RecentLogs } from '@/components/supervisor/student/RecentLogs'
import { ReportCard } from '@/components/supervisor/student/ReportCard'
import { BonusCard } from '@/components/supervisor/student/BonusCard'
import type { TimeLog } from '@/types/attendance.types'

/** Human summary of the student's most recent attendance activity. */
function lastActivity(log?: TimeLog): string {
  if (!log) return 'No activity yet'
  const when = format(new Date(log.date.slice(0, 10) + 'T00:00:00'), 'MMM d, yyyy')
  const what =
    log.status === 'open' ? 'Clocked in — session in progress'
      : log.status === 'verified' ? 'Hours verified'
      : log.status === 'rejected' ? 'Log rejected'
      : log.is_manual ? 'Bonus hours credited'
      : 'Session logged — awaiting verification'
  return `${when} · ${what}`
}

/** Supervisor → one student (layout "SWAP Supervisor Student Detail v2"). */
export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const id = Number(studentId)
  const [marking, setMarking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setMenuOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [menuOpen])

  const { data: result, isLoading } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: () => attendanceApi.getStudentSummary(id),
    enabled: !!studentId,
  })
  // Just the newest log, for the "Last activity" detail.
  const { data: latest } = useQuery({
    queryKey: ['student-logs', studentId, 'latest'],
    queryFn: () => attendanceApi.getStudentLogs(id, { per_page: '1' }),
    enabled: !!studentId,
  })

  const summary = result?.data
  const student = result?.student
  const term = result?.term
  const name = student?.name ?? `Student #${studentId}`
  const required = summary?.required ?? student?.required_hours ?? 0
  const verified = summary?.verified ?? 0
  const pending = summary?.pending ?? 0
  const pace = student?.pace ?? UNKNOWN_PACE
  const bonuses = result?.bonuses ?? []
  const bonusTotal = bonuses.reduce((a, b) => a + b.hours, 0)
  const closed = !!term && term.badge !== 'in_progress'
  const canMark = !!term && term.status !== 'deficient' && term.shortfall > 0

  const details: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: Building2, label: 'Office', value: student?.office ?? '—' },
    { Icon: CalendarDays, label: 'Period', value: [student?.semester, student?.academic_year].filter(Boolean).join(' ') || '—' },
    { Icon: Flag, label: 'Required', value: required ? `${fmtHrs(required)} hours${student?.carried_over_hours ? ` (incl. ${student.carried_over_hours} carried over)` : ''}` : '—' },
    { Icon: CalendarClock, label: 'Term ends', value: term?.effective_end_date ? formatDay(term.effective_end_date, 'long') : 'Not set up yet' },
    { Icon: BadgeCheck, label: 'Program', value: [student?.program, student?.year_level ? `Year ${student.year_level}` : null].filter(Boolean).join(' · ') || '—' },
    { Icon: History, label: 'Last activity', value: lastActivity(latest?.data?.[0]) },
  ]

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-24 animate-pulse rounded-[18px] bg-ink-200/60" />
        <div className="h-64 animate-pulse rounded-[18px] bg-ink-200/60" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <BackLink href="/supervisor/students" label="Back to My students" />

      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={name} avatarUrl={student?.avatar_url} className="h-[60px] w-[60px] rounded-full bg-accent-soft" />
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="break-words text-[22px] font-extrabold tracking-[-0.01em] text-ink-950 sm:text-[26px]">{name}</h1>
            {closed ? (
              <TermBadge badge={term?.badge} deficientHours={term?.deficient_hours} className="px-3 py-1 text-[12px]" />
            ) : (
              <span className={`rounded-full px-[11px] py-1 text-[12px] font-bold ${PACE_TONE[pace.status].pill}`}>
                {pace.status === 'complete' ? 'Qualified' : PACE_META[pace.status].label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {[student?.student_id_number ? `ID ${student.student_id_number}` : null, student?.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/supervisor/students/${studentId}/duty-slip`}
            className="flex h-[42px] items-center gap-[7px] rounded-[11px] border border-ink-200 bg-surface px-3.5 text-[13px] font-semibold text-ink-700 hover:border-accent">
            <FileText className="h-[18px] w-[18px]" /> Duty slip
          </Link>
          <div ref={menu} className="relative">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="More actions" aria-expanded={menuOpen}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px] border border-ink-200 bg-surface text-ink-700 hover:border-accent">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-30 w-[240px] rounded-xl border border-ink-200 bg-surface p-1.5 shadow-[0_14px_36px_rgba(20,40,30,.16)]">
                {canMark ? (
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setMarking(true) }}
                    className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left text-[13px] font-semibold text-danger-700 hover:bg-danger-50">
                    <CircleAlert className="h-[18px] w-[18px]" /> Mark as deficient
                  </button>
                ) : (
                  <p className="flex gap-2.5 p-2.5 text-[12.5px] text-ink-500">
                    <Info className="mt-px h-4 w-4 flex-none" />
                    {term?.status === 'deficient'
                      ? 'Deficient · clears automatically when hours are met.'
                      : 'Nothing to mark: the hours are met.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {term?.status === 'deficient' && (
        <div className="flex items-start gap-3 rounded-[14px] border border-danger-200 bg-danger-50 px-5 py-4 text-sm text-danger-800">
          <CircleAlert className="mt-0.5 h-5 w-5 flex-none text-danger-600" />
          <div>
            <p className="font-semibold">
              Deficient{term.deficient_hours ? ` by ${fmtHrs(term.deficient_hours)} hours` : ''}
              {term.badge === 'promissory_approved' ? ' · promissory note approved' : term.badge === 'promissory_pending' ? ' · promissory note pending your review' : ''}
            </p>
            <p className="mt-0.5 text-danger-700">
              {term.marked_by_supervisor ? 'Marked by a supervisor' : 'Recorded at the end of the semester'}
              {term.marked_at ? ` on ${formatDateTime(term.marked_at)}` : ''}.
              {term.reason ? ` Reason: ${term.reason}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <HoursCard verified={verified} pending={pending} required={required} bonus={bonusTotal} pace={pace}
            startDate={student?.start_date} endDate={term?.effective_end_date} />
          <RecentLogs studentId={id} studentName={name} />
        </div>

        <div className="flex flex-col gap-4">
          <ReportCard studentId={id} studentName={name} report={result?.term_report ?? null}
            remindedToday={!!result?.report_reminded_today} locked={!!result?.report_locked} />
          <BonusCard studentId={id} studentName={name} bonuses={bonuses} />
          <section className={`${CARD} py-1.5`}>
            {details.map((d) => (
              <div key={d.label} className="flex items-center gap-3 px-5 py-2.5">
                <d.Icon className="h-[19px] w-[19px] flex-none text-ink-500" />
                <span className="flex-1 text-[12.5px] text-ink-500">{d.label}</span>
                <span className="max-w-[60%] text-right text-[13px] font-semibold text-ink-900">{d.value}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {marking && term && (
        <MarkDeficientModal studentId={id} studentName={name}
          term={[student?.semester, student?.academic_year].filter(Boolean).join(' ')}
          shortfall={term.shortfall} onClose={() => setMarking(false)} />
      )}
    </div>
  )
}
