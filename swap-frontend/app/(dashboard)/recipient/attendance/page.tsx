'use client'

import { useCallback, useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { ClockCard } from '@/components/recipient/hours/ClockCard'
import { ReportStrip } from '@/components/recipient/hours/ReportStrip'
import { PastTerms, TimeLogList, WeeklyModal, YourHours, useWeeks } from '@/components/recipient/hours/Panels'

/**
 * Recipient → Hours & Attendance (layout "SWAP Recipient Attendance v2"; the old Attendance and
 * Hours pages in one — /recipient/hours redirects here). Clock in/out, the term's hours, every
 * log grouped by day, hours per week (a modal), the end-of-term report (at the top once it's due
 * or submitted) and past terms.
 */
export default function HoursAttendancePage() {
  const { data: summary } = useQuery({ queryKey: ['hours-summary'], queryFn: () => attendanceApi.getHoursSummary() })
  const { data: progress } = useQuery({ queryKey: ['recipient-progress'], queryFn: () => attendanceApi.getProgress() })
  const { data: assignment, isLoading: assignmentLoading } = useQuery({ queryKey: ['recipient-assignment'], queryFn: () => attendanceApi.getMyAssignment() })
  const { data: termReport } = useQuery({ queryKey: ['term-report'], queryFn: attendanceApi.getTermReport })
  const { data: terms = [] } = useQuery({ queryKey: ['term-history'], queryFn: () => attendanceApi.getTermHistory() })

  // The current term's logs, a big page at a time (the day groups, best week and weekly bars read them).
  const logsQuery = useInfiniteQuery({
    queryKey: ['my-logs', 'term'],
    queryFn: ({ pageParam }) => attendanceApi.getMyLogs({ per_page: '100', page: String(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const logs = logsQuery.data?.pages.flatMap((p) => p.data) ?? []
  const weeks = useWeeks(logs)
  const [weekOpen, setWeekOpen] = useState(false)
  const closeWeek = useCallback(() => setWeekOpen(false), [])

  // Live wall clock in the header.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])

  const report = termReport?.data ?? null
  const meta = termReport?.meta
  const endDate = assignment?.effective_end_date ?? progress?.end_date ?? null
  // The report strip leads the page once it matters: submitted, or open to submit (the semester
  // is over, with the hours done or a promissory note filed — the server decides). Locked: at the bottom.
  const reportDue = !!meta?.can_submit && !report?.submitted_at
  const reportOnTop = !!report?.submitted_at || reportDue
  const strip = meta?.has_assignment ? <ReportStrip report={report} meta={meta} due={reportDue && !report?.submitted_at} /> : null
  const termLine = [assignment ? `${assignment.semester} ${assignment.academic_year}` : progress?.term, assignment?.office?.name].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-.02em] text-ink-950">Hours &amp; Attendance</h1>
          {termLine && <p className="mt-1 text-[14px] text-ink-500">{termLine}</p>}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="text-right leading-tight">
            {/* Live clock: the server's render is a second (and a timezone) off by design. */}
            <p className="text-[12px] text-ink-500" suppressHydrationWarning>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <p className="text-[20px] font-extrabold tabular-nums text-ink-950" suppressHydrationWarning>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          {assignment && (
            <button type="button" onClick={() => setWeekOpen(true)}
              className="flex h-11 flex-none items-center gap-2 whitespace-nowrap rounded-xl border border-ink-900/[.14] bg-surface px-4 text-[13.5px] font-bold text-ink-950 hover:border-accent hover:text-accent-strong">
              <BarChart3 className="h-5 w-5 text-accent" /> Hours per week
            </button>
          )}
        </div>
      </div>

      {/* Approved but not placed yet: nothing to clock into. */}
      {!assignmentLoading && assignment === null && (
        <p className="rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-[13px] text-gold-700">
          You don&apos;t have an office assignment yet. You can clock in once the DSA places you; you&apos;ll get a notification.
        </p>
      )}

      {reportOnTop && strip}

      {assignment && (
        <>
          <div className="grid items-stretch gap-[18px] lg:grid-cols-2">
            <ClockCard summary={summary} assignment={assignment} />
            <YourHours summary={summary} progress={progress} assignment={assignment} endDate={endDate} weeks={weeks} />
          </div>

          <TimeLogList logs={logs} loading={logsQuery.isLoading} hasMore={!!logsQuery.hasNextPage}
            onMore={() => logsQuery.fetchNextPage()} loadingMore={logsQuery.isFetchingNextPage} />
        </>
      )}

      {!reportOnTop && strip}
      <PastTerms terms={terms} />

      {weekOpen && <WeeklyModal weeks={weeks} progress={progress} onClose={closeWeek} />}
    </div>
  )
}
