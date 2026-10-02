import { BadgeCheck, CircleAlert, FileClock, FileCheck2, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatHours } from '@/lib/utils/formatHours'
import type { TermBadgeValue } from '@/types/assignment.types'

const STYLE: Record<TermBadgeValue, { label: string; className: string; Icon: typeof BadgeCheck }> = {
  qualified: { label: 'Qualified', className: 'border-success-200 bg-success-50 text-success-700', Icon: BadgeCheck },
  promissory_approved: { label: 'Promissory approved', className: 'border-brand-200 bg-brand-50 text-brand-700', Icon: FileCheck2 },
  promissory_pending: { label: 'Promissory pending', className: 'border-warning-200 bg-warning-50 text-warning-800', Icon: FileClock },
  deficient: { label: 'Deficient', className: 'border-danger-200 bg-danger-50 text-danger-700', Icon: CircleAlert },
  in_progress: { label: 'In progress', className: 'border-ink-200 bg-ink-50 text-ink-500', Icon: Hourglass },
}

/** Filter groups shared by the supervisor roster and Admin → Assignments. */
export const TERM_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'deficient', label: 'Deficient' },
] as const
export type TermFilter = (typeof TERM_FILTERS)[number]['value']

/** Whether a badge falls under a filter chip ("Deficient" covers the promissory states). */
export function matchesTermFilter(badge: TermBadgeValue | undefined, filter: TermFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'deficient') return badge === 'deficient' || badge === 'promissory_pending' || badge === 'promissory_approved'
  return (badge ?? 'in_progress') === filter
}

/** A term's verdict: Qualified, Deficient (with hours short), a promissory state, or In progress. */
export function TermBadge({ badge, deficientHours, className }: {
  badge: TermBadgeValue | undefined
  deficientHours?: number | null
  className?: string
}) {
  const s = STYLE[badge ?? 'in_progress']
  const short = badge && badge !== 'qualified' && badge !== 'in_progress' && deficientHours ? deficientHours : null
  return (
    <span className={cn('inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', s.className, className)}>
      <s.Icon className="h-3 w-3" />
      {s.label}
      {short !== null && <span className="font-medium opacity-80">· {formatHours(short)} short</span>}
    </span>
  )
}
