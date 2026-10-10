import { UNKNOWN_PACE, isBehind, type Pace } from '@/lib/utils/pace'
import { matchesTermFilter } from '@/components/shared/TermBadge'
import type { TermBadgeValue } from '@/types/assignment.types'

// Supervisor → My Students (layout "SWAP Supervisor Students v2"): the row model, groups, filters, sorts.

export type Row = {
  userId: number
  name: string
  email: string
  studentNo: string
  office: string
  avatarUrl: string | null
  verified: number
  required: number
  bonus: number
  pendingRequired: number | null
  pendingLogs: number
  pace: Pace
  term: TermBadgeValue
  deficientHours: number | null
  reportSubmitted: boolean
  /** Submitted and waiting for the supervisor to accept it. */
  reportToReview: boolean
  /** The renewal mark once accepted (null = not accepted yet). */
  reportEligible: boolean | null
  promissory: boolean
  remindedToday: boolean
}

export function toRow(s: Record<string, unknown>): Row {
  const user = (s.user ?? {}) as Record<string, unknown>
  const profile = (user.profile ?? {}) as Record<string, unknown>
  const office = s.office as { name?: string } | null | undefined
  const report = s.term_report as { submitted_at?: string | null; renewal_eligible?: boolean | null } | null | undefined
  return {
    userId: Number(s.user_id ?? s.id ?? 0),
    name: String(user.name ?? '—'),
    email: String(user.email ?? '—'),
    studentNo: String(profile.student_id_number ?? ''),
    office: String(office?.name ?? s.office_name ?? '—'),
    avatarUrl: (user.avatar_url as string | null) ?? null,
    verified: Number(s.verified_hours ?? 0),
    required: Number(s.required_hours ?? 0),
    bonus: Number(s.bonus_hours ?? 0),
    pendingRequired: s.pending_required_hours != null ? Number(s.pending_required_hours) : null,
    pendingLogs: Number(s.pending_logs_count ?? 0),
    pace: (s.pace as Pace | undefined) ?? UNKNOWN_PACE,
    term: (s.term_badge as TermBadgeValue | undefined) ?? 'in_progress',
    deficientHours: s.deficient_hours != null ? Number(s.deficient_hours) : null,
    reportSubmitted: !!report?.submitted_at,
    reportToReview: Boolean(s.report_to_review),
    reportEligible: report?.renewal_eligible ?? null,
    promissory: Boolean(s.has_approved_promissory || s.has_pending_promissory),
    remindedToday: Boolean(s.pace_reminded_today),
  }
}

export const qualified = (r: Row) => r.required > 0 && r.verified >= r.required
export const behind = (r: Row) => !qualified(r) && isBehind(r.pace)
export const needsAction = (r: Row) => r.pendingLogs > 0 || r.reportToReview
export const pctOf = (r: Row) => (r.required > 0 ? Math.min(100, Math.round((r.verified / r.required) * 100)) : 0)

export type GroupKey = 'action' | 'behind' | 'track' | 'qual' | 'all'
export const GROUPS: { key: GroupKey; label: string; test: (r: Row) => boolean; tone: string }[] = [
  { key: 'action', label: 'Needs action', test: needsAction, tone: 'gold' },
  { key: 'behind', label: 'Behind pace', test: behind, tone: 'orange' },
  { key: 'track', label: 'On track', test: (r) => !qualified(r) && !behind(r), tone: 'blue' },
  { key: 'qual', label: 'Qualified', test: qualified, tone: 'green' },
  { key: 'all', label: 'All students', test: () => true, tone: 'grey' },
]

export type FilterKey = 'logs' | 'noRep' | 'repWait' | 'prom' | 'elig' | 'notElig' | 'termQual' | 'termDef'
export const FILTERS: Record<FilterKey, { label: string; test: (r: Row) => boolean }> = {
  logs: { label: 'Has logs to verify', test: (r) => r.pendingLogs > 0 },
  noRep: { label: 'Report not submitted', test: (r) => !r.reportSubmitted },
  repWait: { label: 'Report waiting for me', test: (r) => r.reportToReview },
  prom: { label: 'Promissory note filed', test: (r) => r.promissory },
  elig: { label: 'Eligible for renewal', test: (r) => r.reportEligible === true },
  notElig: { label: 'Not eligible for renewal', test: (r) => r.reportEligible === false },
  termQual: { label: 'Qualified (term closed)', test: (r) => matchesTermFilter(r.term, 'qualified') },
  termDef: { label: 'Deficient (term closed)', test: (r) => matchesTermFilter(r.term, 'deficient') },
}

/** The popover's sections; "Has logs to verify" and "Report waiting" are implied inside Needs action. */
export function filterSections(group: GroupKey): { title: string; keys: FilterKey[] }[] {
  const inAction = group === 'action'
  return [
    ...(inAction ? [] : [{ title: 'HOURS', keys: ['logs'] as FilterKey[] }]),
    { title: 'REPORT', keys: inAction ? ['noRep'] : ['noRep', 'repWait'] },
    { title: 'TERM END', keys: ['prom', 'elig', 'notElig', 'termQual', 'termDef'] },
  ]
}

export type SortKey = 'behind' | 'logs' | 'az'
export const SORTS: { key: SortKey; label: string; cmp: (a: Row, b: Row) => number }[] = [
  { key: 'behind', label: 'Most behind first', cmp: (a, b) => pctOf(a) - pctOf(b) || a.name.localeCompare(b.name) },
  { key: 'logs', label: 'Most logs waiting', cmp: (a, b) => b.pendingLogs - a.pendingLogs || pctOf(a) - pctOf(b) },
  { key: 'az', label: 'Name A–Z', cmp: (a, b) => a.name.localeCompare(b.name) },
]

export const matchesSearch = (r: Row, q: string) =>
  !q || `${r.name} ${r.email} ${r.studentNo} ${r.office}`.toLowerCase().includes(q)

export const barColor = (r: Row) => (qualified(r) ? 'bg-accent' : behind(r) ? 'bg-warning-500' : 'bg-accent-bright')

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'the student'
export const hrs = (v: number) => `${Math.round(v * 10) / 10}h`
