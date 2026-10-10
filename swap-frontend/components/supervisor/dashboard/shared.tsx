import { UserAvatar } from '@/components/shared/UserAvatar'
import type { Pace } from '@/lib/utils/pace'

// Shared look and types for the supervisor dashboard (layout "SWAP Supervisor Dashboard v2").

export const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'

/** One row of GET /supervisor/students (AssignmentResource). */
export type StudentRow = {
  id?: number
  user_id?: number
  user?: { name?: string; avatar_url?: string | null }
  name?: string
  office_name?: string
  office?: { id: number; name: string } | null
  verified_hours?: number
  required_hours?: number
  pace?: Pace
  report_to_review?: boolean
  pace_reminded_today?: boolean
}

export const nameOf = (s: StudentRow) => String(s.user?.name ?? s.name ?? '—')
export const idOf = (s: StudentRow) => Number(s.user_id ?? s.id ?? 0)
export const officeOf = (s: StudentRow) => s.office?.name ?? s.office_name ?? '—'
export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'The student'

/** "4h", "2.5h" */
export const hrs = (v: number | string | null | undefined) => `${Math.round((Number(v) || 0) * 10) / 10}h`

export function Initials({ name, avatarUrl, tone = 'green' }: { name: string; avatarUrl?: string | null; tone?: 'green' | 'red' | 'blue' }) {
  const tones = {
    green: 'bg-accent-soft text-accent-strong',
    red: 'bg-danger-100 text-danger-700',
    blue: 'bg-info-100 text-info-700',
  }
  return <UserAvatar name={name} avatarUrl={avatarUrl} className={`h-[30px] w-[30px] flex-none rounded-full text-[11px] font-bold ${tones[tone]}`} />
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] font-extrabold tracking-[0.08em]">{children}</div>
}
