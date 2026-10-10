'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import { ClockCard } from '@/components/recipient/hours/ClockCard'
import { ReportStrip } from '@/components/recipient/hours/ReportStrip'
import { PastTerms, ProgressHero, ThisTerm, TimeLogList, TodaySessions, WeeklyBars } from '@/components/recipient/hours/Panels'
import { manilaToday } from '@/components/recipient/hours/ui'

/**
 * Recipient → Hours & Attendance (layout "SWAP Recipient Hours - Attendance"; the old
 * Attendance and Hours pages in one — /recipient/hours redirects here). Clock in/out, where
 * the term stands, today's sessions, weekly hours, every log of the term, the end-of-term
 * report (at the top once it's due or submitted) and past terms.
 */
export default function HoursAttendancePage() {
  const { data: summary } = useQuery({ queryKey: ['hours-summary'], queryFn: () => attendanceApi.getHoursSummary() })
  const { data: progress } = useQuery({ queryKey: ['recipient-progress'], queryFn: () => attendanceApi.getProgress() })
  const { data: assignment, isLoading: assignmentLoading } = useQuery({ queryKey: ['recipient-assignment'], queryFn: () => attendanceApi.getMyAssignment() })
  const { data: termReport } = useQuery({ queryKey: ['term-report'], queryFn: attendanceApi.getTermReport })
  const { data: terms = [] } = useQuery({ queryKey: ['term-history'], queryFn: () => attendanceApi.getTermHistory() })

  // The current term's logs, a big page at a time (chips, today's sessions and the weekly bars all read them).
  const logsQuery = useInfiniteQuery({
    queryKey: ['my-logs', 'term'],
    queryFn: ({ pageParam }) => attendanceApi.getMyLogs({ per_page: '100', page: String(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const logs = logsQuery.data?.pages.flatMap((p) => p.data) ?? []

  // Live wall clock in the header.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])

  const report = termReport?.data ?? null
  const meta = termReport?.meta
  const endDate = assignment?.effective_end_date ?? progress?.end_date ?? null
  const hoursDone = !!summary && summary.required > 0 && summary.remaining <= 0
  const ended = !!endDate && endDate < manilaToday()
  // The report strip leads the page once it matters: submitted, hours done, or the term over.
  const reportDue = hoursDone || ended
  const reportOnTop = !!report?.submitted_at || reportDue
  const strip = meta?.has_assignment ? <ReportStrip report={report} meta={meta} due={reportDue && !report?.submitted_at} /> : null
  const termLine = [assignment ? `${assignment.semester} ${assignment.academic_year}` : progress?.term, assignment?.office?.name].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Hours &amp; Attendance</h1>
          {termLine && <p className="mt-1 text-[13.5px] text-ink-500">{termLine}</p>}
        </div>
        <div className="text-right leading-tight">
          {/* Live clock: the server's render is a second (and a timezone) off by design. */}
          <p className="text-[12.5px] text-ink-500" suppressHydrationWarning>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="text-[22px] font-extrabold tabular-nums text-ink-950" suppressHydrationWarning>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>
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
          <div className="grid items-stretch gap-[18px] lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.35fr)]">
            <ClockCard summary={summary} assignment={assignment} />
            <ProgressHero summary={summary} progress={progress} endDate={endDate} />
          </div>

          <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
            <TodaySessions logs={logs} />
            <ThisTerm assignment={assignment} progress={progress} />
          </div>

          <WeeklyBars logs={logs} />
          <TimeLogList logs={logs} loading={logsQuery.isLoading} hasMore={!!logsQuery.hasNextPage}
            onMore={() => logsQuery.fetchNextPage()} loadingMore={logsQuery.isFetchingNextPage} />
        </>
      )}

      {!reportOnTop && strip}
      <PastTerms terms={terms} />
    </div>
  )
}
