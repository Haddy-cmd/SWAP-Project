'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Send, CheckCircle, Ban, Lock } from 'lucide-react'
import Link from 'next/link'
import { adminApi } from '@/lib/api/admin.api'
import { formatDate } from '@/lib/utils/formatDate'
import { useAuthStore } from '@/lib/store/authStore'
import type { StipendRecord, EligibleStipend, StipendStatus } from '@/types/analytics.types'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const STATUS_META: Record<StipendStatus, { label: string; cls: string }> = {
  certified: { label: 'Ready to claim', cls: 'bg-info-50 text-brand-700' },
  claimed: { label: 'Received', cls: 'bg-success-50 text-success-600' },
  void: { label: 'Void', cls: 'bg-danger-50 text-danger-700' },
  pending: { label: 'Pending', cls: 'bg-warning-50 text-warning-600' },
  released: { label: 'Released', cls: 'bg-success-50 text-success-600' },
}

// The page gate stays open for 15 minutes of activity, then re-locks.
const GATE_TIMEOUT_MS = 15 * 60 * 1000

type ApiError = { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }

export default function AdminStipendPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [page, setPage] = useState(1)
  const [voiding, setVoiding] = useState<{ id: number; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Page gate: the unlock token lives in memory only — never persisted.
  const [unlockToken, setUnlockToken] = useState<string | null>(null)
  const [unlockPw, setUnlockPw] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  // Bulk checklist over the eligible list (keys user_id|ay|sem).
  const [selected, setSelected] = useState<string[]>([])
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [bulkResult, setBulkResult] = useState<{ released: number; skipped: { user_id: number; reason: string }[] } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // No data (or page) before the password gate — queries stay disabled until unlock.
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stipend', page],
    queryFn: () => adminApi.getStipendRecords({ page: String(page) }),
    enabled: !!unlockToken,
  })
  const { data: eligible = [] } = useQuery({
    queryKey: ['admin-stipend-eligible'],
    queryFn: () => adminApi.getEligibleStipends(),
    enabled: !!unlockToken,
  })

  // Inactivity closes the gate; any pointer/keyboard activity re-arms the timer.
  useEffect(() => {
    if (!unlockToken) return
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setUnlockToken(null), GATE_TIMEOUT_MS)
    }
    reset()
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [unlockToken])

  // An expired/rejected token re-locks the page so the password is re-entered.
  function gateExpired(message: string) {
    setUnlockToken(null)
    setUnlockPw('')
    setUnlockError(message)
  }

  function mutationError(e: ApiError, fallback: string) {
    const tokenErr = e.response?.data?.errors?.unlock_token?.[0]
    if (tokenErr) { gateExpired(tokenErr); return }
    setError(e.response?.data?.errors?.password?.[0] ?? e.response?.data?.message ?? fallback)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-stipend'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stipend-eligible'] })
  }

  const keyOf = (e: EligibleStipend) => `${e.user_id}|${e.academic_year}|${e.semester}`

  const unlock = useMutation({
    mutationFn: () => adminApi.unlockStipend(unlockPw),
    onSuccess: (d) => { setUnlockToken(d.unlock_token); setUnlockPw(''); setUnlockError(null) },
    onError: (e: ApiError) =>
      setUnlockError(e.response?.data?.errors?.password?.[0] ?? e.response?.data?.message ?? 'Could not unlock.'),
  })

  const releaseBulk = useMutation({
    mutationFn: () => {
      const items = eligible.filter((e) => selected.includes(keyOf(e))).map((e) => ({
        user_id: e.user_id,
        amount: bulkAmount ? Number(bulkAmount) : e.suggested_amount,
        academic_year: e.academic_year,
        semester: e.semester,
        remarks: bulkRemarks || 'Completed required service hours.',
      }))
      return adminApi.releaseBulkStipend({ unlock_token: unlockToken ?? '', items })
    },
    onSuccess: (res) => {
      invalidate()
      setSelected([]); setBulkAmount(''); setBulkRemarks('')
      setBulkResult({ released: res.data.released.length, skipped: res.data.skipped })
    },
    onError: (e: ApiError) => mutationError(e, 'Could not release the selected stubs.'),
  })

  const voidStipend = useMutation({
    mutationFn: (v: { id: number; reason: string }) =>
      adminApi.voidStipend(v.id, v.reason, { unlock_token: unlockToken ?? '' }),
    onSuccess: () => { invalidate(); setVoiding(null) },
    onError: (e: ApiError) => mutationError(e, 'Could not void the stub.'),
  })

  const records = data?.data ?? []

  // The password gate: nothing on this page is accessible before unlock.
  if (!unlockToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-brand-700" />
            <h1 className="text-lg font-bold text-ink-900">Stipend Management</h1>
          </div>
          <p className="mt-1 text-sm text-ink-500">Re-enter your password to access stipend releases. The gate re-locks after 15 minutes of inactivity.</p>
          <div className="relative mt-4">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-350" />
            <input type="password" value={unlockPw} onChange={(e) => setUnlockPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && unlockPw && !unlock.isPending) unlock.mutate() }}
              placeholder="Your password" className={`${INPUT} pl-9`} />
          </div>
          {unlockError && <p className="mt-2 text-sm text-danger-700">{unlockError}</p>}
          <button onClick={() => unlock.mutate()} disabled={unlock.isPending || !unlockPw}
            className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
            {unlock.isPending ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Stipend Management</h1>
        <p className="mt-1 text-sm text-ink-500">Tick eligible recipients and release their claim stubs in one go; each recipient is notified and claims it at the Banking Office.</p>
      </div>

      {/* Releases are blocked server-side without a title — say so up front. */}
      {!user?.position_title && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          Set your position title in <Link href="/profile" className="font-semibold underline">Profile</Link> — releases are blocked until then.
        </div>
      )}

      {/* Always render this section: hiding it when nobody qualifies left the page
          looking exactly like the pre-checklist layout, with no hint why. */}
      {eligible.length > 0 ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" checked={selected.length === eligible.length}
              onChange={(e) => { setBulkResult(null); setSelected(e.target.checked ? eligible.map(keyOf) : []) }}
              className="h-4 w-4 accent-brand-700" aria-label="Select all eligible" />
            <CheckCircle className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-success-800">Eligible for Release</h2>
            <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">{eligible.length}</span>
            {selected.length > 0 && (
              <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-medium text-white">{selected.length} selected</span>
            )}
          </div>
          <p className="mb-3 text-xs text-success-700">Recipients who completed their required verified hours and have not been paid for the period. Tick one or many, then release.</p>
          <div className="space-y-2">
            {eligible.map((e) => {
              const key = keyOf(e)
              const checked = selected.includes(key)
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-success-200 bg-white px-4 py-3">
                  <input type="checkbox" checked={checked}
                    onChange={() => { setBulkResult(null); setSelected((s) => checked ? s.filter((k) => k !== key) : [...s, key]) }}
                    className="h-4 w-4 flex-shrink-0 accent-brand-700" aria-label={`Select ${e.name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{e.name}</p>
                    <p className="text-xs text-ink-500">{e.academic_year} — {e.semester} · {e.verified_hours}/{e.required_hours} hrs verified</p>
                    {e.via_promissory && (
                      <p className="mt-1">
                        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-800">
                          Promissory · lacking {e.lacking_hours} hrs{e.makeup_deadline ? ` · due ${e.makeup_deadline}` : ''}
                        </span>
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold text-brand-700">{PHP.format(e.suggested_amount)}</span>
                </div>
              )
            })}
          </div>
          {selected.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} type="number" min="0"
                placeholder="Amount each (default per-student)" className="w-52 rounded-lg border border-success-200 bg-white px-3 py-2 text-xs focus:outline-none" />
              <input value={bulkRemarks} onChange={(e) => setBulkRemarks(e.target.value)}
                placeholder="Remarks (optional)" className="min-w-52 flex-1 rounded-lg border border-success-200 bg-white px-3 py-2 text-xs focus:outline-none" />
              <button onClick={() => { setError(null); setBulkResult(null); releaseBulk.mutate() }} disabled={releaseBulk.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                <Send className="h-3.5 w-3.5" /> {releaseBulk.isPending ? 'Releasing…' : `Release ${selected.length} selected`}
              </button>
            </div>
          )}
          {bulkResult && (
            <p className="mt-2 text-xs font-medium text-success-800">
              Released {bulkResult.released} stub(s).
              {bulkResult.skipped.length > 0 && (
                <> Skipped {bulkResult.skipped.length}: {bulkResult.skipped.map((s) => `User #${s.user_id} (${s.reason})`).join('; ')}</>
              )}
            </p>
          )}
          {error && <p className="mt-2 text-xs font-medium text-danger-700">{error}</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-success-800">Eligible for Release</h2>
            <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">0</span>
          </div>
          <p className="text-xs text-success-700">No students are eligible yet. A recipient appears here, with a checkbox for bulk release, once their verified hours reach the required hours for the period.</p>
        </div>
      )}

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-200" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center"><DollarSign className="h-10 w-10 text-ink-300" /><p className="text-sm text-ink-350">No stipend records.</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                {['Recipient', 'Control No.', 'Amount', 'Period', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r: StipendRecord) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending
                return (
                  <tr key={r.id} className="border-b border-ink-100 last:border-0 align-middle">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.recipient?.name ?? `User #${r.user_id}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{r.control_number ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-brand-700">{PHP.format(r.amount)}</td>
                    <td className="px-4 py-3 text-ink-500">{r.academic_year} — {r.semester}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      {r.status === 'void' && r.void_reason && <p className="mt-0.5 text-[11px] text-danger-700">{r.void_reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'certified' && (
                        voiding?.id === r.id ? (
                          <div className="flex items-center gap-1.5">
                            <input autoFocus value={voiding.reason} onChange={e => setVoiding(v => v && ({ ...v, reason: e.target.value }))}
                              placeholder="Reason" className="w-32 rounded-lg border border-ink-200 px-2 py-1 text-xs focus:outline-none" />
                            <button onClick={() => voiding.reason && voidStipend.mutate(voiding)} disabled={voidStipend.isPending || !voiding.reason}
                              className="rounded-lg bg-danger-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Void</button>
                            <button onClick={() => setVoiding(null)} className="text-xs text-ink-350">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setVoiding({ id: r.id, reason: '' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-semibold text-danger-700 hover:bg-danger-50">
                            <Ban className="h-3.5 w-3.5" /> Void
                          </button>
                        )
                      )}
                      {r.status === 'claimed' && r.claimed_at && <span className="text-xs text-ink-500">Claimed {formatDate(r.claimed_at)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'
