'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Search, UserCheck, UserX, UserPlus, X, Trash2, Check, ChevronDown, Filter, Send,
} from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { formatDate } from '@/lib/utils/formatDate'

// Soft avatar palettes (bg / fg), mirrored from the mockup.
const AV: [string, string][] = [
  ['#E3EEE5', '#1F5B3A'],
  ['#F3F7FB', '#4A82B8'],
  ['#EFF8F4', '#1F8163'],
  ['#FDF8E4', '#9A7412'],
  ['#EFE9F7', '#6B4E9A'],
  ['#FEF3F2', '#E2483B'],
  ['#F3F7FB', '#234A70'],
]
const av = (i: number) => AV[((i % AV.length) + AV.length) % AV.length]

// Role chip colors: [text, background]
function roleStyle(role: string): [string, string] {
  switch (role) {
    case 'supervisor': return ['#6B4E9A', '#EFE9F7']
    case 'admin': return ['#B45309', '#FDF8E4']
    case 'applicant': return ['#234A70', '#F3F7FB']
    default: return ['#1F5B3A', '#E3EEE5'] // recipient
  }
}

const ROLE_TABS: { label: string; key: string }[] = [
  { label: 'All', key: '' },
  { label: 'Applicants', key: 'applicant' },
  { label: 'Recipients', key: 'recipient' },
  { label: 'Supervisors', key: 'supervisor' },
  { label: 'Admins', key: 'admin' },
]
const STATUS_OPTIONS = ['All', 'Active', 'Inactive'] as const
type StatusKey = (typeof STATUS_OPTIONS)[number]

const inputCls =
  'w-full rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/10'
const labelCls = 'mb-1.5 block text-[12.5px] font-semibold text-ink-600'

function AddUserModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'supervisor', office_id: '' })
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const { data: officesData } = useQuery({
    queryKey: ['admin-offices'],
    queryFn: () => assignmentsApi.getOffices(),
  })
  const offices = officesData?.data ?? []

  // Instead of creating the account here, email an invitation link — the invitee
  // sets their own password and the account is created when they accept.
  const invite = useMutation({
    mutationFn: () =>
      adminApi.inviteUser({
        email: form.email,
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        role: form.role,
        ...(form.role === 'supervisor' && form.office_id ? { office_id: Number(form.office_id) } : {}),
      }),
    onSuccess: (res) => setSent(res.message ?? `Invitation sent to ${form.email}.`),
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const firstError = err.response?.data?.errors && Object.values(err.response.data.errors)[0]?.[0]
      setError(firstError || err.response?.data?.message || 'Failed to send the invitation.')
    },
  })

  const canSave = form.email.trim().length > 3

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/45 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_rgba(11,39,22,.4)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-brand-100 text-brand-700">
              <UserPlus className="h-[20px] w-[20px]" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-ink-950">Invite Staff</p>
              <p className="text-[12.5px] text-ink-500">Email a link to create a supervisor or admin account</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-brand-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
                <Check className="h-7 w-7 text-success-600" strokeWidth={2.5} />
              </span>
              <p className="text-sm font-bold text-ink-950">{sent}</p>
              <p className="max-w-xs text-xs text-ink-500">
                They&apos;ll receive an email with a link to set their password and activate the account.
                The link expires in 3 days — re-invite the same email to send a fresh one.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="supervisor@msumain.edu.ph" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Full Name <span className="font-normal text-ink-400">(optional — they confirm it on sign-up)</span></label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Prof. Juan Dela Cruz" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inputCls}>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-400">Students join by self-registering — invitations are for staff accounts only.</p>
              </div>
              {form.role === 'supervisor' && (
                <div>
                  <label className={labelCls}>Office <span className="font-normal text-ink-400">(optional)</span></label>
                  <select value={form.office_id} onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))} className={inputCls}>
                    <option value="">{offices.length ? 'Assign later…' : 'No offices yet — assign later'}</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-ink-200 bg-ink-50 px-6 py-4">
          {sent ? (
            <button onClick={onClose}
              className="h-11 rounded-xl px-6 text-sm font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,.26)]"
              style={{ background: 'linear-gradient(180deg,#2A7148,#16452B)' }}>
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="h-11 rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-500 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => { setError(''); invite.mutate() }} disabled={!canSave || invite.isPending}
                className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,.26)] transition-opacity disabled:opacity-50"
                style={{ background: 'linear-gradient(180deg,#2A7148,#16452B)' }}>
                <Send className="h-[17px] w-[17px]" />
                {invite.isPending ? 'Sending…' : 'Send Invitation'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState<StatusKey>('All')
  const [statusOpen, setStatusOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const isActiveParam = status === 'Active' ? 'true' : status === 'Inactive' ? 'false' : ''

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role, status],
    queryFn: () => adminApi.getUsers({
      page: String(page),
      ...(search && { search }),
      ...(role && { role }),
      ...(isActiveParam && { is_active: isActiveParam }),
    }),
    placeholderData: keepPreviousData,
  })

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      alert(err.response?.data?.message ?? 'Failed to delete user.')
    },
  })

  const confirmDelete = (id: number, name: string) => {
    if (window.confirm(`Delete ${name}'s account? This cannot be undone.`)) remove.mutate(id)
  }

  const users = data?.data ?? []
  const meta = data?.meta
  const counts = meta?.counts ?? {}
  const allCount = Object.values(counts).reduce((s, n) => s + n, 0)
  const tabCount = (key: string) => (key === '' ? allCount : counts[key] ?? 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">User Management</p>
          <h1 className="font-serif text-3xl font-medium text-ink-950">Users</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex h-11 items-center gap-2 self-start rounded-xl px-5 text-sm font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,.26)] transition-opacity hover:opacity-95 sm:self-auto"
          style={{ background: 'linear-gradient(180deg,#2A7148,#16452B)' }}>
          <UserPlus className="h-[19px] w-[19px]" />
          Invite User
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex items-center gap-5 overflow-x-auto border-b border-ink-200">
        {ROLE_TABS.map((t) => {
          const on = role === t.key
          return (
            <button
              key={t.key || 'all'}
              onClick={() => { setRole(t.key); setPage(1) }}
              className="-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-3 text-sm transition-colors"
              style={{ borderColor: on ? '#1F5B3A' : 'transparent', color: on ? '#1F5B3A' : '#6F7B74', fontWeight: on ? 600 : 500 }}
            >
              {t.label}
              <span
                className="rounded-full px-2 py-px text-[11.5px] font-bold"
                style={on ? { background: '#E3EEE5', color: '#1F5B3A' } : { background: '#ECEFE2', color: '#6F7B74' }}
              >
                {tabCount(t.key)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or email…"
            className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-900 placeholder:text-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/10"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setStatusOpen((s) => !s)}
            className="flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-[13px] font-semibold text-ink-900"
          >
            <Filter className="h-[18px] w-[18px] text-gold-600" />
            Status: {status}
            <ChevronDown className="h-4 w-4 text-ink-400" />
          </button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setStatusOpen(false)} />
              <div className="absolute right-0 top-[52px] z-30 w-44 rounded-xl border border-ink-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(19,36,26,.18)]">
                {STATUS_OPTIONS.map((s) => {
                  const on = status === s
                  return (
                    <button
                      key={s}
                      onClick={() => { setStatus(s); setStatusOpen(false); setPage(1) }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-ink-900"
                      style={{ background: on ? '#FDF8E4' : 'transparent', fontWeight: on ? 700 : 500 }}
                    >
                      {s}
                      {on && <Check className="h-[17px] w-[17px] text-brand-700" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[15px] border border-ink-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Head */}
            <div className="grid grid-cols-[2fr_1fr_1.1fr_0.9fr_180px] gap-4 border-b border-ink-200 bg-ink-50 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              <span>User</span>
              <span>Role</span>
              <span>Joined</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {isLoading ? (
              <div className="space-y-px p-4">
                {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-14 animate-pulse rounded-lg bg-ink-200/40" />)}
              </div>
            ) : users.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-ink-400">No users match your search or filters.</div>
            ) : (
              users.map((user, i) => {
                const [avBg, avFg] = av(i)
                const [rc, rb] = roleStyle(user.role)
                const active = user.is_active
                // An account that hasn't verified its email is a pending signup,
                // shown distinctly from an admin-deactivated (Inactive) account.
                const pending = !user.email_verified_at
                return (
                  <div key={user.id} className="grid grid-cols-[2fr_1fr_1.1fr_0.9fr_180px] items-center gap-4 border-b border-ink-100 px-5 py-3 last:border-0 hover:bg-ink-50/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={user.name} avatarUrl={user.avatar_url}
                        className="h-[38px] w-[38px] rounded-full text-[13px] font-bold"
                        style={{ background: avBg, color: avFg }} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-semibold text-ink-950">{user.name}</p>
                        <p className="truncate text-xs text-ink-400">{user.email}</p>
                      </div>
                    </div>

                    <span className="justify-self-start rounded-[7px] px-2.5 py-1 text-xs font-semibold capitalize"
                      style={{ color: rc, background: rb }}>
                      {user.role}
                    </span>

                    <span className="text-[13px] text-ink-600">{formatDate(user.created_at)}</span>

                    <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1 text-xs font-bold"
                      style={pending
                        ? { color: '#B45309', background: '#FDF8E4' }
                        : active ? { color: '#145643', background: '#EFF8F4' } : { color: '#6F7B74', background: '#ECEFE2' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: pending ? '#F59E0B' : active ? '#1F8163' : '#ADB5A8' }} />
                      {pending ? 'Unverified' : active ? 'Active' : 'Inactive'}
                    </span>

                    <div className="flex items-center justify-end gap-2">
                      {/* Admins can't be deactivated (protected), but an inactive
                          admin can still be reactivated so they're never stranded. */}
                      {user.role === 'admin' && active ? (
                        <span className="text-xs font-medium text-ink-350">Protected</span>
                      ) : (
                        <button
                          onClick={() => toggle.mutate({ id: user.id, is_active: !active })}
                          disabled={toggle.isPending}
                          className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-ink-200 bg-white px-3 text-xs font-semibold transition-colors hover:bg-ink-50 disabled:opacity-50"
                          style={{ color: active ? '#B45309' : '#145643' }}
                        >
                          {active ? <UserX className="h-[15px] w-[15px]" /> : <UserCheck className="h-[15px] w-[15px]" />}
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => confirmDelete(user.id, user.name)}
                          disabled={remove.isPending}
                          title="Delete account"
                          aria-label="Delete account"
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between bg-ink-50 px-5 py-3.5">
              <span className="text-[13px] text-ink-500">
                {meta ? <>Page {meta.current_page} of {meta.last_page} · {meta.total} total</> : '—'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!meta || page <= 1}
                  className="h-9 rounded-[9px] border border-ink-200 bg-white px-4 text-[13px] font-semibold text-brand-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-350 transition-colors">
                  Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={!meta || page >= meta.last_page}
                  className="h-9 rounded-[9px] border border-ink-200 bg-white px-4 text-[13px] font-semibold text-brand-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-350 transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
