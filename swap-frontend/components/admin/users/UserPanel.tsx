'use client'

import { useState } from 'react'
import { BadgeCheck, Building2, CalendarDays, GraduationCap, History, Lock, Mail, Trash2, UserCheck, UserX, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatDate'
import { collegeDisplay } from '@/lib/constants/colleges'
import type { User } from '@/types/auth.types'
import { PersonAvatar, ROLE, RolePill, statusOf } from './shared'

/**
 * One person, as a slide-out styled like the Offices / Assignments panels: dark-green header
 * (role, avatar, name, status), the details, then the actions — history, deactivate/reactivate,
 * delete (records are kept).
 */
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
    // Where a recipient serves now. Skipped when the list didn't send it (e.g. right after an update).
    ...(user.role === 'recipient' && user.assignment !== undefined
      ? user.assignment
        ? [
            { Icon: Building2, k: 'Assigned to', v: user.assignment.office ?? 'Office not set' },
            { Icon: UserCheck, k: 'Supervisor', v: user.assignment.supervisor ?? 'Unassigned' },
            { Icon: CalendarDays, k: 'Term', v: `${user.assignment.semester} ${user.assignment.academic_year}` },
          ]
        : [{ Icon: Building2, k: 'Assigned to', v: 'Not assigned to an office yet' }]
      : []),
    { Icon: CalendarDays, k: 'Joined', v: formatDate(user.created_at) },
  ]

  return (
    <>
      {/* Phones/tablets: a sheet over the page. Wide screens: a panel beside the list (no overlay). */}
      <div onClick={onClose} className="fixed inset-0 z-50 bg-ink-950/30 lg:hidden" aria-hidden />
      <aside role="dialog" aria-label={user.name}
        className="animate-panel-in fixed inset-x-0 bottom-0 z-[51] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[20px] bg-surface pb-safe shadow-[0_-20px_50px_rgba(10,30,20,.18)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:shadow-[-20px_0_50px_rgba(10,30,20,.18)] lg:sticky lg:bottom-auto lg:left-auto lg:right-auto lg:top-[88px] lg:z-auto lg:max-h-[calc(100dvh-110px)] lg:w-auto lg:rounded-[18px] lg:border lg:border-ink-900/[.08] lg:pb-0 lg:shadow-[0_1px_3px_rgba(20,40,30,.05)]">
        {/* Header, like the Offices panel: dark green with a gold glow */}
        <div className="flex-none bg-accent-deep px-6 pb-5 pt-4 text-white"
          style={{ backgroundImage: 'radial-gradient(120% 160% at 100% 0%, rgba(221,187,56,.25), transparent 50%)' }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-gold-accent">{(ROLE[user.role] ?? ROLE.applicant).label}</p>
            <button type="button" onClick={onClose} aria-label="Close"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-white/15 text-white hover:bg-white/25">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3.5">
            <span className="flex-none rounded-full ring-2 ring-white/30"><PersonAvatar user={user} size={52} /></span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[19px] font-extrabold leading-tight">
                {user.name}{isYou && <span className="ml-2 align-middle text-[11px] font-bold text-white/60">(You)</span>}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <RolePill role={user.role} />
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${st.tone}`}>{st.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-6 pb-1 pt-4 text-[15px] font-bold text-ink-950">Details</p>
          <dl>
            {facts.map((f) => (
              <div key={f.k} className="flex items-center gap-3 border-b border-ink-900/[.05] px-6 py-3">
                <f.Icon className="h-[18px] w-[18px] flex-none text-ink-400" />
                <dt className="flex-1 text-[12.5px] text-ink-500">{f.k}</dt>
                <dd className="max-w-[65%] break-words text-right text-[13px] font-semibold text-ink-900">{f.v}</dd>
              </div>
            ))}
          </dl>

          {admin && user.is_active && (
            <p className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-[12.5px] text-ink-600">
              <Lock className="h-[18px] w-[18px] flex-none" /> Admin accounts are protected and can&apos;t be deactivated or deleted here.
            </p>
          )}
          {isYou && !admin && <p className="mt-4 text-center text-[12px] text-ink-400">This is your account.</p>}

          {canDelete && confirmDel && (
            <div className="mx-6 my-4 flex flex-col gap-2.5 rounded-xl bg-danger-50 p-3.5">
              <p className="text-[13px] leading-[1.45] text-danger-800">
                Remove <b>{user.name}</b>&apos;s account? They can no longer sign in. Their past records (applications, hours, stipends) stay for reports and the audit log.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDel(false)} className="h-10 flex-1 rounded-[10px] border border-danger-200 bg-surface text-[13px] font-semibold text-ink-800">Keep</button>
                <button type="button" onClick={onDelete} disabled={busy} className="h-10 flex-1 rounded-[10px] bg-danger-700 text-[13px] font-bold text-white hover:bg-danger-800 disabled:opacity-60">Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions, like the Offices panel footer */}
        <div className="flex flex-none flex-col gap-2 border-t border-ink-900/[.06] bg-ink-50/60 px-6 py-3.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onHistory}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 text-[13.5px] font-semibold text-ink-900 hover:bg-ink-50">
              <History className="h-[18px] w-[18px]" /> Activity history
            </button>
            {canToggle && (
              <button type="button" onClick={onToggle} disabled={busy}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border bg-surface px-3 text-[13.5px] font-semibold disabled:opacity-60 ${
                  user.is_active ? 'border-danger-200 text-danger-700 hover:bg-danger-50' : 'border-accent/40 text-accent-strong hover:bg-accent-tint'}`}>
                {user.is_active ? <UserX className="h-[18px] w-[18px]" /> : <UserCheck className="h-[18px] w-[18px]" />}
                {user.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            )}
          </div>
          {canDelete && !confirmDel && (
            <button type="button" onClick={() => setConfirmDel(true)}
              className="flex h-8 items-center justify-center gap-1.5 text-[13px] font-semibold text-danger-700 hover:text-danger-800">
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
