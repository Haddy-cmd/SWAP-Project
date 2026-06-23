'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Clock, ClipboardCheck, TrendingUp, FileText, Coins, ArrowRight, CheckCircle, Calendar, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { analyticsApi } from '@/lib/api/analytics.api'
import { ApplicantsByCollegeChart } from '@/components/charts/ApplicantsByCollegeChart'

const FALLBACK_YEAR = '2024-2025'
const FALLBACK_SEM = '1st Semester'

const BAR_COLORS = ['#7D1A1A', '#2980B9', '#27AE60', '#E6A817', '#C0563B', '#8E44AD', '#16A085']

const peso = (n: number) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const periodKey = (year: string, sem: string) => `${year}__${sem}`

export default function AdminDashboard() {
  const { data: periods = [] } = useQuery({
    queryKey: ['admin-periods'],
    queryFn: () => analyticsApi.getPeriods(),
  })

  const [selected, setSelected] = useState<string | null>(null)

  // Default to the most recent period with data once the list loads.
  useEffect(() => {
    if (!selected && periods.length) {
      setSelected(periodKey(periods[0].academic_year, periods[0].semester))
    }
  }, [periods, selected])

  const [year, sem] = (selected ?? periodKey(FALLBACK_YEAR, FALLBACK_SEM)).split('__')

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview', year, sem],
    queryFn: () => analyticsApi.getAdminOverview(year, sem),
  })

  const stats = [
    { icon: Users, tint: 'bg-[#FEF0F0] text-[#7D1A1A]', label: 'Active Recipients', value: overview?.active_recipients ?? '—', href: '/admin/users' },
    { icon: Clock, tint: 'bg-[#FEF3E0] text-[#F39C12]', label: 'Pending Applications', value: overview?.pending_applications ?? '—', href: '/admin/applications' },
    { icon: ClipboardCheck, tint: 'bg-[#FDECEC] text-[#A52020]', label: 'Pending Verifications', value: overview?.pending_verifications ?? '—', href: '/admin/analytics' },
    { icon: TrendingUp, tint: 'bg-[#EAF7EF] text-[#27AE60]', label: 'Avg Completion', value: overview != null ? `${overview.avg_completion_rate}%` : '—', href: '/admin/analytics' },
  ]

  const collegeData = (overview?.applicants_by_college ?? []).map((c) => ({
    college: c.college,
    applicants: c.applicant_count,
  }))

  const offices = overview?.office_distribution_all ?? []
  const totalRecipients = offices.reduce((sum, o) => sum + o.recipient_count, 0)

  const pendingApps = overview?.pending_applications ?? 0
  const stipendPending = overview?.stipend_summary?.total_pending ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[#8A6A6A]">Program overview · all offices</p>
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7D1A1A]" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7D1A1A]" />
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!periods.length}
            className="cursor-pointer appearance-none rounded-full border border-[#EFE3E3] bg-white py-2 pl-9 pr-9 text-xs font-semibold text-[#7D1A1A] hover:bg-[#FAF7F7] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15 disabled:opacity-50"
          >
            {periods.length === 0 && <option value="">AY {FALLBACK_YEAR} · {FALLBACK_SEM}</option>}
            {periods.map((p) => (
              <option key={periodKey(p.academic_year, p.semester)} value={periodKey(p.academic_year, p.semester)}>
                AY {p.academic_year} · {p.semester}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ icon: Icon, tint, label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="relative rounded-2xl border border-[#EFE3E3] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p>
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tint}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            {isLoading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-[#EAD9D9]" />
            ) : (
              <p className="mt-2 text-3xl font-extrabold text-[#1E293B]">{String(value)}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Office Distribution + Needs Attention */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Office Distribution — horizontal bars */}
        <div className="rounded-2xl border border-[#EFE3E3] bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-semibold text-[#1E293B]">Office Distribution</h2>
          <p className="mt-0.5 text-sm text-[#8A6A6A]">Recipients assigned per office</p>

          {isLoading ? (
            <div className="mt-5 space-y-4">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-8 animate-pulse rounded-lg bg-[#F1E9E9]" />)}
            </div>
          ) : offices.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#B09A9A]">No active assignments yet.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {offices.map((o, i) => {
                const pct = totalRecipients ? Math.round((o.recipient_count / totalRecipients) * 100) : 0
                const color = BAR_COLORS[i % BAR_COLORS.length]
                return (
                  <div key={o.office_name}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="truncate text-sm font-medium text-[#1E293B]">{o.office_name}</span>
                      </div>
                      <span className="flex-shrink-0 text-xs text-[#8A6A6A]">
                        {o.recipient_count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F1E9E9]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="rounded-2xl border border-[#EFE3E3] bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#1E293B]">Needs Attention</h2>

          <div className="mt-4 space-y-3">
            {/* Pending applications */}
            {pendingApps > 0 ? (
              <Link href="/admin/applications" className="flex items-center gap-3 rounded-xl border border-[#F6E0BE] bg-[#FFF7ED] p-3.5 hover:bg-[#FEEFD8] transition-colors">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FDEBCF]"><FileText className="h-4 w-4 text-[#D97706]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#92400E]">Pending applications</p>
                  <p className="text-xs text-[#B45309]">{pendingApps} awaiting your review</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#92400E]" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-[#CDEBD8] bg-[#F1FAF4] p-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D8F0E2]"><CheckCircle className="h-4 w-4 text-[#1E8E50]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#166534]">Applications</p>
                  <p className="text-xs text-[#15803D]">0 pending — all caught up</p>
                </div>
              </div>
            )}

            {/* Stipend pending */}
            {stipendPending > 0 ? (
              <Link href="/admin/stipend" className="flex items-center gap-3 rounded-xl border border-[#F6E0BE] bg-[#FFF7ED] p-3.5 hover:bg-[#FEEFD8] transition-colors">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FDEBCF]"><Coins className="h-4 w-4 text-[#D97706]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#92400E]">Stipend pending</p>
                  <p className="text-xs text-[#B45309]">{peso(stipendPending)} awaiting release</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#92400E]" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-[#CDEBD8] bg-[#F1FAF4] p-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D8F0E2]"><CheckCircle className="h-4 w-4 text-[#1E8E50]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#166534]">Stipend</p>
                  <p className="text-xs text-[#15803D]">Nothing pending release</p>
                </div>
              </div>
            )}
          </div>

          {/* Program snapshot */}
          <p className="mt-6 mb-3 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Program Snapshot</p>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[#475569]">Total applications</dt>
              <dd className="text-sm font-bold text-[#1E293B]">{overview?.total_applications ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[#475569]">Total offices</dt>
              <dd className="text-sm font-bold text-[#1E293B]">{overview?.total_offices ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[#475569]">Verified hours</dt>
              <dd className="text-sm font-bold text-[#1E293B]">
                {overview != null ? `${Math.round(overview.total_verified_hours)}h` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Applicants by College — full width */}
      <div className="rounded-2xl border border-[#EFE3E3] bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#1E293B]">Applicants by College</h2>
        <p className="mt-0.5 mb-4 text-sm text-[#8A6A6A]">Applications received this semester, grouped by college</p>
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-[#EAD9D9]" />
        ) : (
          <ApplicantsByCollegeChart data={collegeData} />
        )}
      </div>
    </div>
  )
}
