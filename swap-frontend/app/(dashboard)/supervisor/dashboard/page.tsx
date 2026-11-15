'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, ClipboardList, TrendingDown, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { isBehind } from '@/lib/utils/pace'
import { WorkQueue } from '@/components/supervisor/dashboard/WorkQueue'
import { BehindList, BEHIND_HREF } from '@/components/supervisor/dashboard/BehindList'
import { SideColumn } from '@/components/supervisor/dashboard/SideColumn'
import { CountUp } from '@/components/ui/CountUp'
import { firstName, hrs, type StudentRow } from '@/components/supervisor/dashboard/shared'

/** Supervisor home (layout "SWAP Supervisor Dashboard v2"): the work queue first, then who needs help. */
export default function SupervisorDashboard() {
  const { user } = useAuthStore()

  const { data: studentsData } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })
  const { data: clockedIn = [] } = useQuery({
    queryKey: ['supervisor-clocked-in'],
    queryFn: () => attendanceApi.getClockedInStudents(),
    refetchInterval: 20_000,
  })
  const { data: pendingLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['supervisor-pending-logs'],
    queryFn: () => attendanceApi.getPendingVerifications(),
    refetchInterval: 30_000,
  })

  const typed = studentsData as { data?: StudentRow[]; meta?: { verified_hours_this_week?: number } } | undefined
  const students = typed?.data ?? []
  // Verified hours short of what the elapsed term expects, worst first.
  const behind = students
    .filter((s) => isBehind(s.pace))
    .sort((a, b) => (b.pace?.deficit_hours ?? 0) - (a.pace?.deficit_hours ?? 0))
  // End-of-term reports submitted and waiting to be accepted (renewal needs it).
  const reports = students.filter((s) => s.report_to_review)

  const waiting = pendingLogs.length
  const summary = waiting || reports.length
    ? `${waiting} ${waiting === 1 ? 'log' : 'logs'} and ${reports.length} ${reports.length === 1 ? 'report is' : 'reports are'} waiting for you.`
    : "You're all caught up. Nice work."

  const KPIS = [
    { Icon: Users, value: students.length, format: undefined, label: 'Students', tint: 'bg-accent-soft text-accent-strong', href: '/supervisor/students' },
    { Icon: ClipboardList, value: waiting, format: undefined, label: 'To verify', tint: 'bg-warning-50 text-warning-700', href: '/supervisor/verifications' },
    { Icon: BadgeCheck, value: Number(typed?.meta?.verified_hours_this_week ?? 0), format: hrs, label: 'Verified this week', tint: 'bg-info-100 text-info-700', href: '/supervisor/verifications' },
    { Icon: TrendingDown, value: behind.length, format: undefined, label: 'Falling behind', tint: 'bg-warning-50 text-warning-700', href: BEHIND_HREF },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em] text-ink-950">Good day, {firstName(user?.name)}</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">{summary}</p>
        </div>
        <div className="stagger flex flex-wrap gap-2.5">
          {KPIS.map(({ Icon, value, format, label, tint, href }) => (
            <Link key={label} href={href}
              className="flex items-center gap-2.5 rounded-[14px] border border-ink-900/[.08] bg-surface py-2 pl-2.5 pr-3.5 transition-colors hover:border-accent/40">
              <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${tint}`}><Icon className="h-[18px] w-[18px]" /></span>
              <span className="leading-tight">
                <CountUp value={value} format={format} className="block text-[18px] font-extrabold text-ink-950" />
                <span className="block text-[11.5px] text-ink-500">{label}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Wide: three columns that each scroll inside the screen. Narrower: the queue on top, the rest below. */}
      <div className="grid gap-4 md:grid-cols-2 xl:h-[calc(100dvh-210px)] xl:min-h-[560px] xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(260px,.85fr)]">
        <div className="flex h-[520px] min-h-0 flex-col md:col-span-2 xl:col-span-1 xl:h-auto">
          <WorkQueue logs={pendingLogs} reports={reports} loading={logsLoading} />
        </div>
        <div className="flex h-[440px] min-h-0 flex-col xl:h-auto">
          <BehindList students={behind} />
        </div>
        <div className="flex h-[440px] min-h-0 flex-col xl:h-auto">
          <SideColumn onDuty={clockedIn} students={students} />
        </div>
      </div>
    </div>
  )
}
