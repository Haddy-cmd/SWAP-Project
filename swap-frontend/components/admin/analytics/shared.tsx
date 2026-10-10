'use client'

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api/analytics.api'
import type { ReportDrill } from '@/lib/utils/reportQuery'

/** Shared look and data for the Analytics & reports tabs (layout "SWAP Admin Analytics v2"). */

export const GREEN = '#17815F'
export const GOLD = '#DDBB38'
export const RED = '#C8322B'
export const BLUE = '#2E5C8A'
export const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-white shadow-[0_1px_3px_rgba(20,40,30,.05)]'

/** Busy supervisor: mirrors SupervisorReminderService::BUSY_PENDING / BUSY_DAYS. */
export const BUSY_PENDING = 10
export const BUSY_DAYS = 3
export const isBusy = (pending: number, oldestDays: number | null) =>
  pending > 0 && (pending >= BUSY_PENDING || (oldestDays ?? 0) >= BUSY_DAYS)

/** ProgramInsightsService::blockReason() for a renewal that can be approved now. */
export const READY = 'Ready to approve'

export interface TabProps {
  academicYear: string
  semester: string
  onDrill: (d: ReportDrill) => void
}

/** The term's overview and insights, shared (and cached once) by every tab. */
export function useAnalytics(academicYear: string, semester: string) {
  const overview = useQuery({
    queryKey: ['admin-overview', academicYear, semester],
    queryFn: () => analyticsApi.getAdminOverview(academicYear, semester),
  })
  const insights = useQuery({
    queryKey: ['admin-insights', academicYear, semester],
    queryFn: () => analyticsApi.getInsights(academicYear, semester),
  })
  return { overview: overview.data, insights: insights.data, loading: overview.isLoading || insights.isLoading }
}

export function Card({ title, hint, right, children, className = '' }: {
  title?: ReactNode; hint?: ReactNode; right?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`${CARD} px-6 py-5 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15.5px] font-bold text-ink-950">{title}</h2>}
            {hint && <p className="mt-0.5 text-[12.5px] text-ink-500">{hint}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** A small text segmented control (Bar / Donut, Most hours / A–Z …). */
export function Seg<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-none gap-0.5 rounded-[10px] bg-ink-100/70 p-[3px]">
      {options.map(([v, name]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={`h-7 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors ${
            v === value ? 'bg-white text-ink-950 shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-500 hover:text-ink-800'}`}>
          {name}
        </button>
      ))}
    </div>
  )
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-ink-500">{label}</span>
      {children}
    </div>
  )
}

export const SELECT = 'h-9 cursor-pointer rounded-[10px] border border-ink-200 bg-white pl-3 pr-8 text-[13px] font-semibold text-ink-900 focus:border-[#17815F] focus:outline-none'

export function Skeleton({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} animate-pulse rounded-[18px] bg-ink-100`} />
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
