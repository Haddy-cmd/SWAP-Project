'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Loader2, Search, UserPlus, UserX } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { useAuthStore } from '@/lib/store/authStore'
import { formatDate } from '@/lib/utils/formatDate'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { AuditHistoryDrawer } from '@/components/admin/AuditHistory'
import { InviteModal } from '@/components/admin/users/InviteModal'
import { UserPanel } from '@/components/admin/users/UserPanel'
import { PersonAvatar, RolePill, refOf } from '@/components/admin/users/shared'
import type { User } from '@/types/auth.types'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const SELECT = 'h-[46px] rounded-[13px] border border-ink-900/[.1] bg-surface px-3 text-[13.5px] font-semibold text-ink-700 focus:border-accent focus:outline-none'
const GRID = 'sm:grid sm:grid-cols-[44px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_32px] sm:items-center sm:gap-3'
const PER_PAGE = 30

const ROLE_TABS = [
  { key: '', label: 'All' },
  { key: 'applicant', label: 'Applicants' },
  { key: 'recipient', label: 'Recipients' },
  { key: 'supervisor', label: 'Supervisors' },
  { key: 'admin', label: 'Admins' },
]
type Status = 'all' | 'active' | 'inactive' | 'unverified'
type Sort = 'new' | 'old' | 'az'

/** Admin → Users (layout "SWAP Admin Users v2"). */
export default function AdminUsersPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { notify, notifyError, confirm } = useFeedback()

  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [sort, setSort] = useState<Sort>('new')
  const [sel, setSel] = useState<number[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [history, setHistory] = useState<{ id: number; name: string } | null>(null)
  const [inviting, setInviting] = useState(false)

  // Search after a short pause in typing.
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => setSel([]), [role, search, status, sort])

  const list = useInfiniteQuery({
    queryKey: ['admin-users', role, search, status, sort],
    queryFn: ({ pageParam }) => adminApi.getUsers({
      page: String(pageParam), per_page: String(PER_PAGE), sort,
      ...(role && { role }),
      ...(search && { search }),
      ...(status === 'active' && { is_active: 'true' }),
      ...(status === 'inactive' && { is_active: 'false' }),
      ...(status === 'unverified' && { unverified: '1' }),
    }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const users = list.data?.pages.flatMap((p) => p.data) ?? []
  const meta = list.data?.pages[0]?.meta as ({ total?: number; counts?: Record<string, number> } | undefined)
  const counts = meta?.counts ?? {}
  const tabCount = (key: string) => (key ? counts[key] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0))
  const open = users.find((u) => u.id === openId) ?? null

  const selectable = (u: User) => u.role !== 'admin' && u.id !== me?.id && u.is_active
  const shownSelectable = users.filter(selectable)
  const allSel = shownSelectable.length > 0 && shownSelectable.every((u) => sel.includes(u.id))
  const toggleSel = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  const toggle = useMutation({
    mutationFn: (u: User) => adminApi.updateUser(u.id, { is_active: !u.is_active }),
    onSuccess: (_r, u) => {
      refresh()
      notify(u.is_active
        ? { title: `${u.name} deactivated`, detail: "Signed out everywhere and can't sign in until reactivated." }
        : { title: `${u.name} reactivated`, detail: 'They can sign in again.' })
    },
    onError: (e) => notifyError(e, 'Could not change the account'),
  })
  const remove = useMutation({
    mutationFn: (u: User) => adminApi.deleteUser(u.id),
    onSuccess: (_r, u) => { setOpenId(null); refresh(); notify({ title: `${u.name}'s account removed`, detail: 'Their past records are kept.' }) },
    onError: (e) => notifyError(e, 'Could not delete the account'),
  })
  const bulk = useMutation({
    mutationFn: () => adminApi.bulkDeactivate(sel),
    onSuccess: (r) => { setSel([]); refresh(); notify({ title: r.message, detail: r.data.skipped ? `${r.data.skipped} skipped (admins, you, or already deactivated).` : null }) },
    onError: (e) => notifyError(e, 'Could not deactivate the accounts'),
  })

  const askToggle = async (u: User) => {
    if (u.is_active && !(await confirm({
      title: `Deactivate ${u.name}?`, body: "They're signed out everywhere and can't sign in until an admin reactivates the account.",
      confirmLabel: 'Deactivate', tone: 'danger',
    }))) return
    toggle.mutate(u)
  }
  const askBulk = async () => {
    if (await confirm({
      title: `Deactivate ${sel.length} ${sel.length === 1 ? 'account' : 'accounts'}?`,
      body: "They're signed out everywhere and can't sign in until reactivated.", confirmLabel: 'Deactivate', tone: 'danger',
    })) bulk.mutate()
  }

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink-950">Users</h1>
          <p className="mt-1 text-[14px] text-ink-500">Everyone who can sign in to SWAP. Click a person to see details or change access.</p>
        </div>
        <button type="button" onClick={() => setInviting(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-[18px] text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(23,129,95,.25)] hover:bg-accent-hover">
          <UserPlus className="h-5 w-5" /> Invite user
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div role="tablist" className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-[13px] border border-ink-900/[.08] bg-surface p-1">
          {ROLE_TABS.map((t) => {
            const on = role === t.key
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setRole(t.key)}
                className={`flex h-9 items-center gap-[7px] rounded-[10px] px-[13px] text-[13px] font-semibold ${on ? 'bg-accent-deep text-white' : 'text-ink-600 hover:bg-ink-50'}`}>
                {t.label}<span className="text-[11.5px] font-bold opacity-65">{tabCount(t.key)}</span>
              </button>
            )
          })}
        </div>
        <label className="flex h-[46px] min-w-[220px] flex-1 items-center gap-2 rounded-[13px] border border-ink-900/[.1] bg-surface px-3.5 focus-within:border-accent">
          <Search className="h-5 w-5 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or ID" aria-label="Search users"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status" className={SELECT}>
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
          <option value="unverified">Not verified</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className={SELECT}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="az">Name A–Z</option>
        </select>
      </div>

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-accent-deep py-2.5 pl-[18px] pr-3 text-white">
          <span className="flex-1 text-[13.5px] font-semibold">{sel.length} selected</span>
          <button type="button" onClick={askBulk} disabled={bulk.isPending}
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-white/25 px-3.5 text-[13px] font-semibold hover:bg-white/10 disabled:opacity-60">
            {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-[18px] w-[18px]" />} Deactivate
          </button>
          <button type="button" onClick={() => setSel([])} className="h-9 rounded-[10px] bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/20">Clear</button>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className={`hidden border-b border-ink-900/[.06] px-5 py-3 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-400 ${GRID}`}>
          <input type="checkbox" checked={allSel} disabled={!shownSelectable.length} aria-label="Select all shown"
            onChange={(e) => setSel(e.target.checked ? shownSelectable.map((u) => u.id) : [])} className="h-4 w-4 accent-[var(--color-accent)]" />
          <span>Person</span><span>Role</span><span>Joined</span><span />
        </div>

        {list.isLoading ? (
          <div className="space-y-px">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse bg-ink-50" />)}</div>
        ) : users.length === 0 ? (
          <p className="px-5 py-12 text-center text-[14px] text-ink-500">No one matches. Try a different search or filter.</p>
        ) : users.map((u) => {
          const isSel = sel.includes(u.id)
          const isYou = u.id === me?.id
          return (
            <div key={u.id} role="button" tabIndex={0} onClick={() => setOpenId(u.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(u.id) }}
              className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-900/[.04] px-4 py-3 last:border-0 hover:bg-ink-50 sm:px-5 ${GRID} ${isSel ? 'bg-accent-tint' : ''} ${u.is_active ? '' : 'opacity-60'}`}>
              <span className="flex w-6 items-center sm:w-auto" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSel} disabled={!selectable(u)} onChange={() => toggleSel(u.id)}
                  aria-label={`Select ${u.name}`} title={selectable(u) ? undefined : u.role === 'admin' ? 'Admins are protected' : isYou ? 'This is you' : 'Already deactivated'}
                  className="h-4 w-4 accent-[var(--color-accent)] disabled:opacity-30" />
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
                <PersonAvatar user={u} />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-bold text-ink-950">
                    <span className="truncate">{u.name}</span>
                    {!u.is_active && <span className="flex-none rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-700">Deactivated</span>}
                    {u.is_active && !u.email_verified_at && <span className="flex-none rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-bold text-warning-700">Not verified</span>}
                    {isYou && <span className="flex-none rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">You</span>}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-500">{[refOf(u), u.email].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              <span className="ml-9 sm:ml-0 sm:justify-self-start"><RolePill role={u.role} /></span>
              <span className="text-[13px] text-ink-600">{formatDate(u.created_at)}</span>
              <ChevronRight className="hidden h-5 w-5 text-ink-300 sm:block" />
            </div>
          )
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[12.5px] text-ink-400">
          <span>Showing {users.length} of {meta?.total ?? users.length}</span>
          {list.hasNextPage && (
            <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}
              className="flex h-9 items-center gap-2 rounded-[10px] border border-ink-200 bg-surface px-4 text-[13px] font-semibold text-ink-700 hover:border-accent disabled:opacity-60">
              {list.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load more
            </button>
          )}
        </div>
      </div>

      {open && (
        <UserPanel user={open} isYou={open.id === me?.id} busy={toggle.isPending || remove.isPending}
          onClose={() => setOpenId(null)}
          onHistory={() => { setHistory({ id: open.id, name: open.name }); setOpenId(null) }}
          onToggle={() => askToggle(open)}
          onDelete={() => remove.mutate(open)} />
      )}
      {history && <AuditHistoryDrawer scope={{ subjectUserId: history.id }} title={`History · ${history.name}`} onClose={() => setHistory(null)} />}
      {inviting && <InviteModal onClose={() => { setInviting(false); refresh() }} />}
    </div>
  )
}
