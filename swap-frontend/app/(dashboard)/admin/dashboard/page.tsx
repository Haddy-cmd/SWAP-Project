'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, FileText, BarChart2, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { analyticsApi } from '@/lib/api/analytics.api'
import { MonthlyApplicationsChart } from '@/components/charts/MonthlyApplicationsChart'
import { OfficeDistributionChart } from '@/components/charts/OfficeDistributionChart'

const CURRENT_YEAR = '2024-2025'
const CURRENT_SEM = '1st Semester'

export default function AdminDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview', CURRENT_YEAR, CURRENT_SEM],
    queryFn: () => analyticsApi.getAdminOverview(CURRENT_YEAR, CURRENT_SEM),
  })

  const stats = [
    { icon: <FileText className="h-5 w-5 text-[#7D1A1A]" />, label: 'Total Applications', value: overview?.total_applications ?? '—', href: '/admin/applications' },
    { icon: <Users className="h-5 w-5 text-[#27AE60]" />, label: 'Active Recipients', value: overview?.active_recipients ?? '—', href: '/admin/users' },
    { icon: <BarChart2 className="h-5 w-5 text-[#F39C12]" />, label: 'Pending Applications', value: overview?.pending_applications ?? '—', href: '/admin/applications' },
    { icon: <ClipboardList className="h-5 w-5 text-[#A52020]" />, label: 'Offices', value: overview?.total_offices ?? '—', href: '/admin/offices' },
  ]

  const monthlyData = (overview?.monthly_stats ?? []).map((m) => ({
    month: m.month,
    submitted: m.total_applications,
    approved: m.approved,
    rejected: m.rejected,
  }))

  const officeData = (overview?.office_distribution ?? []).map((o) => ({
    office: o.office_name,
    count: o.recipient_count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          {CURRENT_YEAR} — {CURRENT_SEM} overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-4 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF0F0]">
              {s.icon}
            </div>
            <div>
              {isLoading ? (
                <div className="h-7 w-12 animate-pulse rounded bg-[#EAD9D9]" />
              ) : (
                <p className="text-2xl font-bold text-[#1E293B]">{String(s.value)}</p>
              )}
              <p className="text-xs text-[#8A6A6A]">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Monthly Applications</h2>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" />
          ) : (
            <MonthlyApplicationsChart data={monthlyData} />
          )}
        </div>
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Office Distribution</h2>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" />
          ) : (
            <OfficeDistributionChart data={officeData} />
          )}
        </div>
      </div>
    </div>
  )
}
