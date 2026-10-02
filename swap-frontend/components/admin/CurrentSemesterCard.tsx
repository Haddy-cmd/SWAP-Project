'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarRange, RefreshCw } from 'lucide-react'
import { semestersApi } from '@/lib/api/semesters.api'
import { daysLeftText, formatDay, periodRange } from '@/lib/utils/semester'

/**
 * Admin dashboard: which term the calendar says it is (Admin → Semesters), how long
 * it has left and whether renewal is open — or that the DSA hasn't set one up.
 */
export function CurrentSemesterCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['semester-current'],
    queryFn: () => semestersApi.current(),
  })

  if (isLoading) return <div className="h-[92px] animate-pulse rounded-[14px] bg-ink-200/60" />
  if (isError || !data) return null

  const { current, next, renewal } = data

  let title: string
  let detail: string
  if (current) {
    title = current.label
    detail = `${periodRange(current)} · ${daysLeftText(current.days_left)}`
  } else if (next) {
    title = 'Between semesters'
    detail = `${next.label} starts ${formatDay(next.start_date, 'long')}`
  } else {
    title = 'No semester set up'
    detail = 'Add the current semester so pace, promissory notes and renewal know the term dates.'
  }

  return (
    <Link href="/admin/semesters"
      className={`group flex flex-wrap items-center gap-4 rounded-[14px] border bg-white px-5 py-4 transition hover:shadow-md ${
        current ? 'border-ink-200 hover:border-ink-300' : 'border-warning-200 bg-warning-50/40 hover:border-warning-300'
      }`}>
      <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${current ? 'bg-brand-50' : 'bg-warning-100'}`}>
        <CalendarRange className={`h-5 w-5 ${current ? 'text-brand-700' : 'text-warning-600'}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">Current semester</div>
        <div className="text-[15px] font-bold text-ink-950">{title}</div>
        <div className="text-[12.5px] text-ink-500">{detail}</div>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        renewal ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-ink-200 bg-ink-50 text-ink-500'
      }`}>
        <RefreshCw className="h-3.5 w-3.5" />
        {renewal ? `Renewal open · ${renewal.label}` : 'Renewal closed'}
      </span>
      <ArrowUpRight className="h-4 w-4 text-ink-350 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}
