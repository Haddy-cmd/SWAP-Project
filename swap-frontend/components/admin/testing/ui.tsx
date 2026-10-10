import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { TestingAccount, TestingAssignment } from '@/types/testing.types'

/** Shared look and the account "stage" for Admin → System Testing (layout "System Testing v2"). */

export const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
export const RED = 'var(--color-red-strong)'

export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()

/** The account's current placement (the active one, else the latest). */
export const currentTerm = (a: TestingAccount): TestingAssignment | undefined =>
  a.assignments.find((x) => x.status === 'active') ?? a.assignments[0]

/** A released stipend (claimed/certified/pending are legacy stubs, also paid). */
export const stipendPaid = (t?: TestingAssignment) => !!t?.stipend

/** Whether the term has ended: a verdict is recorded or its last day has passed. */
export const termEnded = (t?: TestingAssignment) => {
  if (!t) return false
  if (t.term_badge && t.term_badge !== 'in_progress') return true
  if (!t.end_date) return false
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  return t.end_date < today
}

export interface Step { key: string; label: string; note: string; done: boolean }

/** Hours → Term ends → Report → Stipend → Renewal: the order the real rules allow them in. */
export function stepsOf(a: TestingAccount): Step[] {
  const t = currentTerm(a)
  const renewal = a.applications.find((x) => x.type === 'renewal')
  const verified = t?.verified_hours ?? 0
  const required = t?.required_hours ?? 0
  return [
    { key: 'hours', label: 'Hours', note: t ? `${verified}h / ${required}h` : 'No term', done: !!t && required > 0 && verified >= required },
    { key: 'term', label: 'Term ends', note: !t ? '—' : t.term_badge && t.term_badge !== 'in_progress' ? termLabel(t) : termEnded(t) ? 'Ended' : 'Active', done: termEnded(t) },
    { key: 'report', label: 'Report', note: !t ? '—' : t.report_eligible !== null ? `Accepted · ${t.report_eligible ? 'eligible' : 'not eligible'}` : t.report_submitted ? 'Submitted' : 'Not submitted', done: t?.report_eligible != null },
    { key: 'stipend', label: 'Stipend', note: stipendPaid(t) ? 'Released' : 'Not released', done: stipendPaid(t) },
    { key: 'renewal', label: 'Renewal', note: renewal ? cap(renewal.status) : 'Not submitted', done: !!renewal },
  ]
}

export function termLabel(t: TestingAssignment): string {
  switch (t.term_badge) {
    case 'qualified': return 'Qualified'
    case 'deficient': return 'Deficient'
    case 'promissory_pending': return 'Deficient · note waiting'
    case 'promissory_approved': return 'Deficient · note approved'
    default: return termEnded(t) ? 'Ended' : 'Active'
  }
}

export const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, ' ')

/** The short line under an account in the list: its next open step. */
export function stageOf(a: TestingAccount): string {
  if (a.role === 'applicant') {
    const app = a.applications[0]
    return app ? `Application · ${cap(app.status)}` : 'No application yet'
  }
  const steps = stepsOf(a)
  const next = steps.find((s) => !s.done)
  if (!next) return 'Renewal submitted'
  if (next.key === 'hours') return steps[0].note
  const prev = steps[steps.indexOf(next) - 1]
  return prev ? `${prev.label} · ${prev.note}` : next.note
}

/** A small outlined shortcut button. */
export function Shortcut({ icon: Icon, label, onClick, disabled, title, danger }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; title?: string; danger?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="flex h-8 items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-2.5 text-xs font-semibold hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
      style={{ color: danger ? RED : 'var(--text-ink-700)' }}>
      <Icon className="h-[15px] w-[15px]" /> {label}
    </button>
  )
}

/** A numbered shortcut card: "1 Service hours", "2 End of term"… */
export function StepCard({ n, title, right, children }: { n: number; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col gap-3.5 px-5 py-[18px]`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-white">{n}</span>
        <span className="flex-1 text-[14.5px] font-bold">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Pill({ children, fg, bg }: { children: ReactNode; fg: string; bg: string }) {
  return <span className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ color: fg, background: bg }}>{children}</span>
}
