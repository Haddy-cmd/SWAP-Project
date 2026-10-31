'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, NotebookPen } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import type { Assignment } from '@/types/assignment.types'

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

/**
 * Recipient dashboard: the end-of-term narrative report can be submitted (the semester is over,
 * with the hours done or a promissory note filed — the server's `can_submit`) and it isn't in yet.
 * The stipend and the renewal both need it.
 */
export function TermReportDueBanner({ assignment }: { assignment: Assignment }) {
  const { data } = useQuery({ queryKey: ['term-report'], queryFn: attendanceApi.getTermReport })

  const end = assignment.effective_end_date
  const ended = !!end && end < manilaToday()
  // Only once the student can actually submit (the server decides: semester over, hours done or a promissory note filed).
  if (!data || data.data?.submitted_at || !data.meta.can_submit) return null

  const term = `${assignment.semester} ${assignment.academic_year}`

  return (
    <Link href="/recipient/attendance#report"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4 transition-colors hover:bg-warning-100/60">
      <NotebookPen className="h-5 w-5 flex-none text-warning-600" />
      <p className="min-w-0 flex-1 text-sm text-warning-800">
        <strong>{ended ? `${term} has ended` : 'Your required hours are complete'} — submit your end-of-term narrative report.</strong>{' '}
        Your stipend can&apos;t be released without it{ended ? ', and your renewal needs it too' : ''}.
      </p>
      <ArrowRight className="h-4 w-4 flex-none text-warning-700" />
    </Link>
  )
}
