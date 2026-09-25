'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Clock, UserCheck, TrendingUp, FileText, Coins, ArrowRight, ArrowUpRight, CheckCircle, Calendar, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { analyticsApi } from '@/lib/api/analytics.api'

const FALLBACK_YEAR = '2024-2025'
const FALLBACK_SEM = '1st Semester'

// Office / donut segment palette.
// Seal-derived series order: green, gold, maroon, blue, teal, violet, grey.
const OFFICE_COLORS = ['#1F5B3A', '#D4AE22', '#A31A1E', '#2F5D8A', '#1F8163', '#6B4E9A', '#8C968F']

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

  const kpis = [
    { icon: Users, color: '#1F5B3A', label: 'Active Recipients', value: overview?.active_recipients ?? '—', href: '/admin/assignments' },
    { icon: Clock, color: '#D97706', label: 'Pending Apps', value: overview?.pending_applications ?? '—', href: '/admin/applications' },
    { icon: UserCheck, color: '#4A82B8', label: 'Approved Apps', value: overview?.approved ?? '—', href: '/admin/assignments' },
    { icon: TrendingUp, color: '#1F8163', label: 'Avg Completion', value: overview != null ? `${overview.avg_completion_rate}%` : '—', href: '/admin/analytics' },
  ]

  // Office distribution → donut segments.
  const offices = overview?.office_distribution_all ?? []
  const totalRecipients = offices.reduce((sum, o) => sum + o.recipient_count, 0)
  let acc = 0
  const segments = offices.map((o, i) => {
    const pct = totalRecipients ? (o.recipient_count / totalRecipients) * 100 : 0
    const seg = `${OFFICE_COLORS[i % OFFICE_COLORS.length]} ${acc}% ${acc + pct}%`
    acc += pct
    return seg
  })
  const donutGradient = totalRecipients ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#DCE0CF 0 100%)'

  // Applicants by college → bars.
  const colleges = overview?.applicants_by_college ?? []
  const maxCollege = Math.max(1, ...colleges.map((c) => c.applicant_count))
  const totalApplicants = colleges.reduce((sum, c) => sum + c.applicant_count, 0)

  const pendingApps = overview?.pending_applications ?? 0
  const stipendPending = overview?.stipend_summary?.total_pending ?? 0

  return (
    <div className="space-y-[18px] text-ink-950">
      {/* Header + AY selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] font-medium tracking-tight text-ink-950">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-500">Program overview · all offices</p>
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-600" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!periods.length}
            className="h-[42px] cursor-pointer appearance-none rounded-[11px] border border-ink-200 bg-white pl-10 pr-9 text-[13.5px] font-semibold text-ink-900 shadow-[0_2px_6px_rgba(19,36,26,0.05)] hover:bg-ink-50 focus:border-brand-700 focus:outline-none disabled:opacity-50"
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

      {/* Compact KPI strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-ink-200 bg-ink-200 lg:grid-cols-4">
        {kpis.map(({ icon: Icon, color, label, value, href }) => (
          <Link key={label} href={href} className="group bg-white px-5 py-5 transition-colors hover:bg-ink-50">
            <div className="mb-2.5 flex items-center gap-2">
              <Icon className="h-[17px] w-[17px]" style={{ color }} />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">{label}</span>
              <ArrowUpRight className="ml-auto h-4 w-4 text-ink-350 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {isLoading ? (
              <div className="h-9 w-14 animate-pulse rounded bg-ink-200" />
            ) : (
              <span className="font-serif text-[34px] font-semibold leading-none text-ink-950">{String(value)}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Donut + right column */}
      <div className="grid gap-[18px] lg:grid-cols-[1fr_1.4fr]">
        {/* Office Distribution donut */}
        <Link href="/admin/offices" className="group block rounded-[14px] border border-ink-200 bg-white p-6 transition hover:border-ink-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold text-ink-950">Office Distribution</div>
            <ArrowUpRight className="h-4 w-4 text-ink-350 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 text-[12.5px] text-ink-500">Recipients per office</div>

          <div className="my-6 flex items-center justify-center">
            <div className="flex h-[168px] w-[168px] items-center justify-center rounded-full" style={{ background: donutGradient }}>
              <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-white">
                <span className="font-serif text-[32px] font-semibold leading-none text-ink-950">{totalRecipients}</span>
                <span className="text-[10.5px] text-ink-400">recipients</span>
              </div>
            </div>
          </div>

          {offices.length === 0 ? (
            <p className="py-2 text-center text-[12.5px] text-ink-400">No active assignments yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {offices.map((o, i) => {
                const pct = totalRecipients ? Math.round((o.recipient_count / totalRecipients) * 100) : 0
                return (
                  <div key={o.office_name} className="flex items-center gap-2 text-[12.5px] text-ink-600">
                    <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ backgroundColor: OFFICE_COLORS[i % OFFICE_COLORS.length] }} />
                    <span className="truncate">{o.office_name}</span>
                    <span className="ml-auto flex-shrink-0 text-ink-400">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </Link>

        {/* Right column */}
        <div className="flex flex-col gap-[18px]">
          {/* Applicants by College bars */}
          <Link href="/admin/applications" className="group block rounded-[14px] border border-ink-200 bg-white p-6 transition hover:border-ink-300 hover:shadow-md">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-bold text-ink-950">Applicants by College</div>
                <div className="mt-0.5 text-[12.5px] text-ink-500">Applications this semester</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-500">{totalApplicants} total</span>
                <ArrowUpRight className="h-4 w-4 text-ink-350 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>

            {isLoading ? (
              <div className="h-[150px] animate-pulse rounded-xl bg-ink-100" />
            ) : colleges.length === 0 ? (
              <p className="py-12 text-center text-[12.5px] text-ink-400">No applications this period.</p>
            ) : (
              <div className="flex h-[150px] items-end gap-5 px-1">
                {colleges.map((c) => {
                  const zero = c.applicant_count === 0
                  const height = zero ? 4 : 25 + (c.applicant_count / maxCollege) * 65
                  return (
                    <div key={c.college} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-xs font-bold" style={{ color: zero ? '#ADB5A8' : '#56625A' }}>{c.applicant_count}</span>
                      <div
                        className="w-full max-w-[50px] rounded-t-[7px]"
                        style={{ height: `${height}%`, background: zero ? '#DCE0CF' : 'linear-gradient(180deg,#2A7148,#1F5B3A)' }}
                      />
                      <span className="truncate text-[11.5px] text-ink-400">{c.college}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Link>

          {/* Mini stat strip */}
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-ink-200 bg-ink-200">
            {([
              ['Applications', overview?.total_applications ?? '—', '/admin/applications'],
              ['Offices', overview?.total_offices ?? '—', '/admin/offices'],
              ['Verified', overview != null ? `${Math.round(overview.total_verified_hours)}h` : '—', '/admin/analytics'],
            ] as [string, string | number, string][]).map(([label, value, href]) => (
              <Link key={label} href={href} className="bg-white px-4 py-5 text-center transition-colors hover:bg-ink-50">
                <div className="font-serif text-[26px] font-semibold text-ink-950">{String(value)}</div>
                <div className="mt-1 text-[11px] text-ink-400">{label}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      <div className="rounded-[14px] border border-ink-200 bg-white p-6">
        <div className="mb-4 text-[15px] font-bold text-ink-950">Needs Attention</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Applications */}
          {pendingApps > 0 ? (
            <Link href="/admin/applications" className="flex items-center gap-3.5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-4 transition-colors hover:bg-warning-100">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-warning-100"><FileText className="h-5 w-5 text-warning-600" /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-bold text-warning-800">Applications</div>
                <div className="text-xs text-warning-700">{pendingApps} pending your review</div>
              </div>
              <ArrowRight className="h-4 w-4 flex-none text-warning-800" />
            </Link>
          ) : (
            <div className="flex items-center gap-3.5 rounded-xl border border-success-200 bg-success-50 px-4 py-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-success-100"><CheckCircle className="h-5 w-5 text-success-600" /></span>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-success-800">Applications</div>
                <div className="text-xs text-success-700">0 pending — all caught up</div>
              </div>
            </div>
          )}

          {/* Stipend */}
          {stipendPending > 0 ? (
            <Link href="/admin/stipend" className="flex items-center gap-3.5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-4 transition-colors hover:bg-warning-100">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-warning-100"><Coins className="h-5 w-5 text-warning-600" /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-bold text-warning-800">Stipend</div>
                <div className="text-xs text-warning-700">{peso(stipendPending)} awaiting release</div>
              </div>
              <ArrowRight className="h-4 w-4 flex-none text-warning-800" />
            </Link>
          ) : (
            <div className="flex items-center gap-3.5 rounded-xl border border-success-200 bg-success-50 px-4 py-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-success-100"><Coins className="h-5 w-5 text-success-600" /></span>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-success-800">Stipend</div>
                <div className="text-xs text-success-700">Nothing pending release</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
