'use client'

import { useState } from 'react'
import { BadgeCheck, Building2, CalendarDays, GraduationCap, History, Lock, Mail, Trash2, UserCheck, UserX, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatDate'
import { collegeDisplay } from '@/lib/constants/colleges'
import type { User } from '@/types/auth.types'
import { PersonAvatar, RolePill, statusOf } from './shared'

/** One person: facts, history, deactivate/reactivate, delete (records are kept). */
export function UserPanel({ user, isYou, busy, onClose, onHistory, onToggle, onDelete }: {
  user: User
  isYou: boolean
  busy: boolean
  onClose: () => void
  onHistory: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const st = statusOf(user)
  const admin = user.role === 'admin'
  // Admins can't be deactivated, but an inactive admin can be reactivated so they're never stranded.
  const canToggle = !isYou && (!admin || !user.is_active)
  const canDelete = !isYou && !admin

  const facts: { Icon: LucideIcon; k: string; v: string }[] = [
    ...(user.profile?.student_id_number ? [{ Icon: BadgeCheck, k: 'Student ID', v: user.profile.student_id_number }] : []),
    ...(user.employee_id ? [{ Icon: BadgeCheck, k: 'Employee ID', v: user.employee_id }] : []),
    { Icon: Mail, k: 'Email', v: user.email },
    ...(user.profile?.college ? [{ Icon: GraduationCap, k: 'College', v: collegeDisplay(user.profile.college) }] : []),
    ...(user.profile?.program ? [{ Icon: GraduationCap, k: 'Program', v: `${user.profile.program}${user.profile.year_level ? ` · Year ${user.profile.year_level}` : ''}` }] : []),
    ...(user.role === 'supervisor' ? [{ Icon: Building2, k: 'Office', v: user.office_name ?? 'Not assigned' }] : []),
    { Icon: CalendarDays, k: 'Joined', v: formatDate(user.created_at) },
  ]

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-ink-950/30" aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={user.name}
        className="fixed inset-x-0 bottom-0 z-[51] flex max-h-[92dvh] flex-col overflow-auto rounded-t-[20px] bg-surface pb-safe shadow-[0_-20px_50px_rgba(10,30,20,.18)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:shadow-[-20px_0_50px_rgba(10,30,20,.18)]">
        <div className="flex justify-end p-3.5">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-ink-100 text-ink-700 hover:bg-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center px-7 pb-5 text-center">
          <PersonAvatar user={user} size={76} />
          <p className="mt-3 break-words text-[19px] font-extrabold text-ink-950">{user.name}{isYou && <span className="ml-2 align-middle text-[11px] font-bold text-ink-400">(You)</span>}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <RolePill role={user.role} />
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${st.tone}`}>{st.label}</span>
          </div>
        </div>

        <dl className="border-t border-ink-900/[.06]">
          {facts.map((f) => (
            <div key={f.k} className="flex items-center gap-3 border-b border-ink-900/[.04] px-7 py-3">
              <f.Icon className="h-[19px] w-[19px] flex-none text-ink-500" />
              <dt className="flex-1 text-[12.5px] text-ink-500">{f.k}</dt>
              <dd className="max-w-[65%] break-words text-right text-[13px] font-semibold text-ink-900">{f.v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2.5 px-7 py-5">
          <button type="button" onClick={onHistory}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface text-[13.5px] font-semibold text-ink-900 hover:bg-ink-50">
            <History className="h-[19px] w-[19px]" /> View activity history
          </button>

          {canToggle && (
            <button type="button" onClick={onToggle} disabled={busy}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border bg-surface text-[13.5px] font-semibold disabled:opacity-60 ${
                user.is_active ? 'border-danger-200 text-danger-700 hover:bg-danger-50' : 'border-accent/40 text-accent-strong hover:bg-accent-tint'}`}>
              {user.is_active ? <UserX className="h-[19px] w-[19px]" /> : <UserCheck className="h-[19px] w-[19px]" />}
              {user.is_active ? 'Deactivate account' : 'Reactivate account'}
            </button>
          )}

          {canDelete && (confirmDel ? (
            <div className="flex flex-col gap-2.5 rounded-xl bg-danger-50 p-3.5">
              <p className="text-[13px] leading-[1.45] text-danger-800">
                Remove <b>{user.name}</b>&apos;s account? They can no longer sign in. Their past records (applications, hours, stipends) stay for reports and the audit log.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDel(false)} className="h-10 flex-1 rounded-[10px] border border-danger-200 bg-surface text-[13px] font-semibold text-ink-800">Keep</button>
                <button type="button" onClick={onDelete} disabled={busy} className="h-10 flex-1 rounded-[10px] bg-danger-700 text-[13px] font-bold text-white hover:bg-danger-800 disabled:opacity-60">Delete</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)}
              className="flex h-10 items-center justify-center gap-1.5 text-[13px] font-semibold text-danger-700 hover:text-danger-800">
              <Trash2 className="h-[18px] w-[18px]" /> Delete account
            </button>
          ))}

          {admin && user.is_active && (
            <p className="flex items-center gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-[12.5px] text-ink-600">
              <Lock className="h-[18px] w-[18px] flex-none" /> Admin accounts are protected and can&apos;t be deactivated or deleted here.
            </p>
          )}
          {isYou && !admin && <p className="text-center text-[12px] text-ink-400">This is your account.</p>}
        </div>
      </aside>
    </>
  )
}
