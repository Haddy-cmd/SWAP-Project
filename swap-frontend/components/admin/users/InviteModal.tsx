'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BadgeCheck, Check, ShieldCheck, X } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { assignmentsApi } from '@/lib/api/assignments.api'

const INPUT = 'h-[46px] w-full rounded-xl border-[1.5px] border-ink-200 bg-surface px-3.5 text-sm text-ink-900 placeholder:text-ink-350 focus:border-accent focus:outline-none'
const ROLES = [
  { key: 'supervisor', label: 'Supervisor', Icon: BadgeCheck },
  { key: 'admin', label: 'Admin', Icon: ShieldCheck },
] as const

/** Invite a staff member: an emailed link lets them set their own password. */
export function InviteModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'supervisor', office_id: '' })
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const { data: officesData } = useQuery({ queryKey: ['admin-offices'], queryFn: () => assignmentsApi.getOffices({ per_page: '100' }) })
  const offices = officesData?.data ?? []

  const invite = useMutation({
    mutationFn: () =>
      adminApi.inviteUser({
        email: form.email.trim(),
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        role: form.role,
        ...(form.role === 'supervisor' && form.office_id ? { office_id: Number(form.office_id) } : {}),
      }),
    onSuccess: (res) => setSent(res.message ?? `Invite sent to ${form.email.trim()}.`),
    onError: (e: unknown) => {
      const err = e as { errors?: Record<string, string[]>; message?: string }
      setError((err.errors && Object.values(err.errors)[0]?.[0]) || err.message || 'Failed to send the invitation.')
    },
  })
  const valid = /^\S+@\S+\.\S+$/.test(form.email.trim())

  return (
    <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/35 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Invite a user" onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-[22px] bg-surface p-[26px] shadow-[0_30px_70px_rgba(0,0,0,.25)]">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong"><Check className="h-7 w-7" strokeWidth={2.5} /></span>
            <p className="text-[15px] font-bold text-ink-950">{sent}</p>
            <p className="max-w-xs text-[12.5px] text-ink-500">The link expires in 3 days. Invite the same email again to send a fresh one.</p>
            <button type="button" onClick={onClose} className="mt-2 h-11 w-full rounded-xl bg-accent text-sm font-bold text-white hover:bg-accent-hover">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[19px] font-extrabold text-ink-950">Invite a user</p>
                <p className="mt-0.5 text-[13px] text-ink-500">They&apos;ll get an email with a link to set their password.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X className="h-5 w-5" /></button>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-800">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@msumain.edu.ph" autoFocus className={INPUT} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-800">Name <span className="font-normal text-ink-400">(optional, they confirm it)</span></span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Prof. Juan Dela Cruz" className={INPUT} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-800">Role</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ key, label, Icon }) => {
                  const on = form.role === key
                  return (
                    <button key={key} type="button" onClick={() => setForm((f) => ({ ...f, role: key }))} aria-pressed={on}
                      className={`flex h-[46px] items-center gap-2 rounded-xl border-[1.5px] px-3 text-[13.5px] font-semibold text-ink-900 ${on ? 'border-accent bg-accent-tint' : 'border-ink-200 bg-surface'}`}>
                      <Icon className={`h-[19px] w-[19px] ${on ? 'text-accent' : 'text-ink-400'}`} /> {label}
                    </button>
                  )
                })}
              </div>
              <span className="text-[12px] text-ink-400">Students join by applying, so only staff are invited.</span>
            </div>
            {form.role === 'supervisor' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink-800">Office <span className="font-normal text-ink-400">(optional)</span></span>
                <select value={form.office_id} onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))} className={INPUT}>
                  <option value="">{offices.length ? 'Assign later…' : 'No offices yet, assign later'}</option>
                  {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">{error}</p>}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={onClose} className="h-[46px] flex-1 rounded-xl border border-ink-200 bg-surface text-sm font-semibold text-ink-700 hover:bg-ink-50">Cancel</button>
              <button type="button" onClick={() => { setError(''); invite.mutate() }} disabled={!valid || invite.isPending}
                className="h-[46px] flex-1 rounded-xl bg-accent text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50">
                {invite.isPending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
