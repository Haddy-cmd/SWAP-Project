'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Clock, FileText, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'

export default function RecipientDashboard() {
  const { user } = useAuthStore()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          Track your service hours and attendance below.
        </p>
      </div>

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
