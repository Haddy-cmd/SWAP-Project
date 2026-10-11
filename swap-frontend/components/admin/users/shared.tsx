import { BadgeCheck, GraduationCap, Hourglass, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import type { User } from '@/types/auth.types'

/** Role pill look (theme tokens) and icon. */
export const ROLE: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  applicant: { label: 'Applicant', Icon: Hourglass, tone: 'bg-info-100 text-info-700' },
  recipient: { label: 'Recipient', Icon: GraduationCap, tone: 'bg-accent-soft text-accent-strong' },
  supervisor: { label: 'Supervisor', Icon: BadgeCheck, tone: 'bg-violet-100 text-violet-600' },
  admin: { label: 'Admin', Icon: ShieldCheck, tone: 'bg-gold-50 text-warning-700' },
}

export function RolePill({ role }: { role: string }) {
  const r = ROLE[role] ?? ROLE.applicant
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${r.tone}`}>
      <r.Icon className="h-[15px] w-[15px]" /> {r.label}
    </span>
  )
}

export const initialsOf = (name: string) =>
  name.replace(/\./g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** Photo when there is one, else coloured initials in the role's tone (grey when deactivated). */
export function PersonAvatar({ user, size = 40 }: { user: User; size?: number }) {
  const tone = user.is_active ? (ROLE[user.role] ?? ROLE.applicant).tone : 'bg-ink-100 text-ink-400'
  if (user.avatar_url) {
    return <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="flex-none rounded-full" style={{ width: size, height: size }} />
  }
  return (
    <span className={`flex flex-none items-center justify-center rounded-full font-bold ${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}>
      {initialsOf(user.name)}
    </span>
  )
}

/** "ID 202334864" / "EMP 2019..." — the reference shown under the name. */
export const refOf = (u: User) =>
  u.profile?.student_id_number ? `ID ${u.profile.student_id_number}` : u.employee_id ? `EMP ${u.employee_id}` : ''

export const statusOf = (u: User): { label: string; tone: string } =>
  !u.email_verified_at ? { label: 'Not verified', tone: 'bg-gold-50 text-warning-700' }
    : u.is_active ? { label: 'Active', tone: 'bg-accent-soft text-accent-strong' }
      : { label: 'Deactivated', tone: 'bg-danger-50 text-danger-700' }
