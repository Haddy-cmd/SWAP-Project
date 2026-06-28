'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Clock, UserCheck, TrendingUp, FileText, Coins, ArrowRight, ArrowUpRight, CheckCircle, Calendar, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { analyticsApi } from '@/lib/api/analytics.api'

const FALLBACK_YEAR = '2024-2025'
const FALLBACK_SEM = '1st Semester'

// Office / donut segment palette.
const OFFICE_COLORS = ['#7C1B26', '#3B7FB5', '#4E9657', '#D8A12B', '#C0562F', '#6B4E9A', '#16A085']

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
    { icon: Users, color: '#7C1B26', label: 'Active Recipients', value: overview?.active_recipients ?? '—', href: '/admin/assignments' },
    { icon: Clock, color: '#C68A3E', label: 'Pending Apps', value: overview?.pending_applications ?? '—', href: '/admin/applications' },
    { icon: UserCheck, color: '#3B7FB5', label: 'Approved Apps', value: overview?.approved ?? '—', href: '/admin/assignments' },
    { icon: TrendingUp, color: '#4E9657', label: 'Avg Completion', value: overview != null ? `${overview.avg_completion_rate}%` : '—', href: '/admin/analytics' },
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
  const donutGradient = totalRecipients ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#E6D8CB 0 100%)'

  // Applicants by college → bars.
  const colleges = overview?.applicants_by_college ?? []
  const maxCollege = Math.max(1, ...colleges.map((c) => c.applicant_count))
  const totalApplicants = colleges.reduce((sum, c) => sum + c.applicant_count, 0)

  const pendingApps = overview?.pending_applications ?? 0
  const stipendPending = overview?.stipend_summary?.total_pending ?? 0

  return (
    <div className="space-y-[18px] text-[#241715]">
      {/* Header + AY selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] font-medium tracking-tight text-[#241715]">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-[#8A7A73]">Program overview · all offices</p>
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A9823C]" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B79B7E]" />
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!periods.length}
            className="h-[42px] cursor-pointer appearance-none rounded-[11px] border border-[#EADFD4] bg-white pl-10 pr-9 text-[13.5px] font-semibold text-[#2B1E1B] shadow-[0_2px_6px_rgba(60,30,25,0.05)] hover:bg-[#FBF7F2] focus:border-[#7C1B26] focus:outline-none disabled:opacity-50"
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
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-[#EFE5DA] bg-[#EFE5DA] lg:grid-cols-4">
        {kpis.map(({ icon: Icon, color, label, value, href }) => (
          <Link key={label} href={href} className="group bg-white px-5 py-5 transition-colors hover:bg-[#FBF7F2]">
            <div className="mb-2.5 flex items-center gap-2">
              <Icon className="h-[17px] w-[17px]" style={{ color }} />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A38A82]">{label}</span>
              <ArrowUpRight className="ml-auto h-4 w-4 text-[#C9B7AC] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {isLoading ? (
              <div className="h-9 w-14 animate-pulse rounded bg-[#EFE5DA]" />
            ) : (
              <span className="font-serif text-[34px] font-semibold leading-none text-[#241715]">{String(value)}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Donut + right column */}
      <div className="grid gap-[18px] lg:grid-cols-[1fr_1.4fr]">
        {/* Office Distribution donut */}
        <Link href="/admin/offices" className="group block rounded-[14px] border border-[#EFE5DA] bg-white p-6 transition hover:border-[#E0CFC2] hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold text-[#241715]">Office Distribution</div>
            <ArrowUpRight className="h-4 w-4 text-[#C9B7AC] opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 text-[12.5px] text-[#8A7A73]">Recipients per office</div>

          <div className="my-6 flex items-center justify-center">
            <div className="flex h-[168px] w-[168px] items-center justify-center rounded-full" style={{ background: donutGradient }}>
              <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-white">
                <span className="font-serif text-[32px] font-semibold leading-none text-[#241715]">{totalRecipients}</span>
                <span className="text-[10.5px] text-[#A38A82]">recipients</span>
              </div>
            </div>
          </div>

          {offices.length === 0 ? (
            <p className="py-2 text-center text-[12.5px] text-[#B09A9A]">No active assignments yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {offices.map((o, i) => {
                const pct = totalRecipients ? Math.round((o.recipient_count / totalRecipients) * 100) : 0
                return (
                  <div key={o.office_name} className="flex items-center gap-2 text-[12.5px] text-[#5A4A45]">
                    <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ backgroundColor: OFFICE_COLORS[i % OFFICE_COLORS.length] }} />
                    <span className="truncate">{o.office_name}</span>
                    <span className="ml-auto flex-shrink-0 text-[#A38A82]">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </Link>

        {/* Right column */}
        <div className="flex flex-col gap-[18px]">
          {/* Applicants by College bars */}
          <Link href="/admin/applications" className="group block rounded-[14px] border border-[#EFE5DA] bg-white p-6 transition hover:border-[#E0CFC2] hover:shadow-md">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-bold text-[#241715]">Applicants by College</div>
                <div className="mt-0.5 text-[12.5px] text-[#8A7A73]">Applications this semester</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#F4ECE1] px-3 py-1.5 text-xs font-semibold text-[#8A7A73]">{totalApplicants} total</span>
                <ArrowUpRight className="h-4 w-4 text-[#C9B7AC] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>

            {isLoading ? (
              <div className="h-[150px] animate-pulse rounded-xl bg-[#F4ECE1]" />
            ) : colleges.length === 0 ? (
              <p className="py-12 text-center text-[12.5px] text-[#B09A9A]">No applications this period.</p>
            ) : (
              <div className="flex h-[150px] items-end gap-5 px-1">
                {colleges.map((c) => {
                  const zero = c.applicant_count === 0
                  const height = zero ? 4 : 25 + (c.applicant_count / maxCollege) * 65
                  return (
                    <div key={c.college} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-xs font-bold" style={{ color: zero ? '#C9B7AC' : '#5A4A45' }}>{c.applicant_count}</span>
                      <div
                        className="w-full max-w-[50px] rounded-t-[7px]"
                        style={{ height: `${height}%`, background: zero ? '#E6D8CB' : 'linear-gradient(180deg,#9A2231,#7C1B26)' }}
                      />
                      <span className="truncate text-[11.5px] text-[#A38A82]">{c.college}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Link>

          {/* Mini stat strip */}
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-[#EFE5DA] bg-[#EFE5DA]">
            {([
              ['Applications', overview?.total_applications ?? '—', '/admin/applications'],
              ['Offices', overview?.total_offices ?? '—', '/admin/offices'],
              ['Verified', overview != null ? `${Math.round(overview.total_verified_hours)}h` : '—', '/admin/analytics'],
            ] as [string, string | number, string][]).map(([label, value, href]) => (
              <Link key={label} href={href} className="bg-white px-4 py-5 text-center transition-colors hover:bg-[#FBF7F2]">
                <div className="font-serif text-[26px] font-semibold text-[#241715]">{String(value)}</div>
                <div className="mt-1 text-[11px] text-[#A38A82]">{label}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      <div className="rounded-[14px] border border-[#EFE5DA] bg-white p-6">
        <div className="mb-4 text-[15px] font-bold text-[#241715]">Needs Attention</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Applications */}
          {pendingApps > 0 ? (
            <Link href="/admin/applications" className="flex items-center gap-3.5 rounded-xl border border-[#F6E0BE] bg-[#FFF7ED] px-4 py-4 transition-colors hover:bg-[#FEEFD8]">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#FDEBCF]"><FileText className="h-5 w-5 text-[#C68A3E]" /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-bold text-[#92400E]">Applications</div>
                <div className="text-xs text-[#B45309]">{pendingApps} pending your review</div>
              </div>
              <ArrowRight className="h-4 w-4 flex-none text-[#92400E]" />
            </Link>
          ) : (
            <div className="flex items-center gap-3.5 rounded-xl border border-[#D6EBD8] bg-[#EEF7EF] px-4 py-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#DCEFDD]"><CheckCircle className="h-5 w-5 text-[#4E9657]" /></span>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-[#2C5A33]">Applications</div>
                <div className="text-xs text-[#5C8463]">0 pending — all caught up</div>
              </div>
            </div>
          )}

          {/* Stipend */}
          {stipendPending > 0 ? (
            <Link href="/admin/stipend" className="flex items-center gap-3.5 rounded-xl border border-[#F6E0BE] bg-[#FFF7ED] px-4 py-4 transition-colors hover:bg-[#FEEFD8]">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#FDEBCF]"><Coins className="h-5 w-5 text-[#C68A3E]" /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-bold text-[#92400E]">Stipend</div>
                <div className="text-xs text-[#B45309]">{peso(stipendPending)} awaiting release</div>
              </div>
              <ArrowRight className="h-4 w-4 flex-none text-[#92400E]" />
            </Link>
          ) : (
            <div className="flex items-center gap-3.5 rounded-xl border border-[#D6EBD8] bg-[#EEF7EF] px-4 py-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#DCEFDD]"><Coins className="h-5 w-5 text-[#4E9657]" /></span>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-[#2C5A33]">Stipend</div>
                <div className="text-xs text-[#5C8463]">Nothing pending release</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
