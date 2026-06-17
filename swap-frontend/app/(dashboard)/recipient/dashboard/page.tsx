'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Clock, FileText, TrendingUp, Building2, MapPin, UserCog } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Welcome, {user?.name}</h1>
          <p className="mt-1 text-sm text-[#8A6A6A]">
            Track your service hours and attendance below.
          </p>
        </div>
        {currentLog?.time_in && (
          <Link href="/recipient/attendance" className="transition-transform hover:scale-[1.02]">
            <LiveTimerChip timeIn={currentLog.time_in} />
          </Link>
        )}
      </div>

      {/* Where you're assigned */}
      {assignment ? (
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF0F0]">
                <Building2 className="h-5 w-5 text-[#7D1A1A]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A6A6A]">Your Assignment</p>
                <p className="font-semibold text-[#1E293B]">{assignment.office?.name ?? 'Office'}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#64748B]">
                  {assignment.office?.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{assignment.office.location}</span>
                  )}
                  {assignment.supervisor?.name && (
                    <span className="inline-flex items-center gap-1"><UserCog className="h-3 w-3" />{assignment.supervisor.name}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8A6A6A]">{assignment.academic_year} · {assignment.semester}</p>
              <p className="text-sm font-semibold text-[#7D1A1A]">{assignment.required_hours}h required</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#DCC5C5] bg-white p-5 text-sm text-[#8A6A6A]">
          You don&apos;t have an active office assignment yet. Please wait for the admin to assign you to an office.
        </div>
      )}

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/recipient/attendance', icon: <Clock className="h-5 w-5 text-[#7D1A1A]" />, label: 'Time In / Out', sub: 'Scan your QR code' },
          { href: '/recipient/hours', icon: <TrendingUp className="h-5 w-5 text-[#7D1A1A]" />, label: 'My Hours', sub: 'View all logs' },
          { href: '/recipient/reports/weekly', icon: <FileText className="h-5 w-5 text-[#7D1A1A]" />, label: 'Weekly Report', sub: 'Download report' },
          { href: '/recipient/stipend', icon: <QrCode className="h-5 w-5 text-[#7D1A1A]" />, label: 'Stipend', sub: 'Disbursement history' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-[#EAD9D9] bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF0F0]">
              {item.icon}
            </div>
            <div>
              <p className="font-semibold text-[#1E293B]">{item.label}</p>
              <p className="text-xs text-[#8A6A6A]">{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Hours progress */}
      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-[#1E293B]">Service Hours Progress</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-8 animate-pulse rounded-lg bg-[#EAD9D9]" />
            ))}
          </div>
        ) : summary ? (
          <HoursProgress summary={summary} />
        ) : (
          <p className="text-sm text-[#B09A9A]">No assignment found.</p>
        )}
      </div>
    </div>
  )
}
