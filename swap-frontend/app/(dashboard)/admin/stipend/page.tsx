'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Send, CheckCircle, Ban, Lock } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord, EligibleStipend, StipendStatus } from '@/types/analytics.types'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const STATUS_META: Record<StipendStatus, { label: string; cls: string }> = {
  certified: { label: 'Ready to claim', cls: 'bg-[#EAF1F7] text-[#1B4F72]' },
  claimed: { label: 'Received', cls: 'bg-green-50 text-[#27AE60]' },
  void: { label: 'Void', cls: 'bg-[#FDF0E9] text-[#B0562F]' },
  pending: { label: 'Pending', cls: 'bg-yellow-50 text-[#F39C12]' },
  released: { label: 'Released', cls: 'bg-green-50 text-[#27AE60]' },
}

const EMPTY = { user_id: '', amount: '5000', academic_year: '2024-2025', semester: '1st Semester', remarks: '', password: '' }

export default function AdminStipendPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [voiding, setVoiding] = useState<{ id: number; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stipend', page],
    queryFn: () => adminApi.getStipendRecords({ page: String(page) }),
  })
  const { data: eligible = [] } = useQuery({
    queryKey: ['admin-stipend-eligible'],
    queryFn: () => adminApi.getEligibleStipends(),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-stipend'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stipend-eligible'] })
  }

  function prefillRelease(e: EligibleStipend) {
    setError(null)
    setForm({
      user_id: String(e.user_id),
      amount: String(e.suggested_amount),
      academic_year: e.academic_year,
      semester: e.semester,
      remarks: 'Completed required service hours.',
      password: '',
    })
    setShowForm(true)
  }

  const release = useMutation({
    mutationFn: () => adminApi.releaseStipend({
      user_id: Number(form.user_id),
      amount: form.amount ? Number(form.amount) : undefined,
      academic_year: form.academic_year,
      semester: form.semester,
      remarks: form.remarks || undefined,
      password: form.password,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(EMPTY) },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setError(e.response?.data?.errors?.password?.[0] ?? e.response?.data?.message ?? 'Could not release the stub.'),
  })

  const voidStipend = useMutation({
    mutationFn: (v: { id: number; reason: string }) => adminApi.voidStipend(v.id, v.reason),
    onSuccess: () => { invalidate(); setVoiding(null) },
  })

  const records = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Stipend Management</h1>
          <p className="mt-1 text-sm text-[#64748B]">Release a claim stub; the recipient is notified and claims it at the Banking Office.</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setError(null); setShowForm(true) }}
          className="flex items-center gap-2 rounded-xl bg-[#1B4F72] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors">
          <Send className="h-4 w-4" /> Release Claim Stub
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-[#1E293B]">Release Claim Stub</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Recipient ID">
              <input type="number" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="Amount (PHP)">
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={INPUT} />
            </Field>
          </div>
          <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Remarks (optional)" className={INPUT} />
          <Field label="Your password (to authorize this release)">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Re-enter your password" className={`${INPUT} pl-9`} />
            </div>
          </Field>
          {error && <p className="text-sm text-[#C0392B]">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setError(null); release.mutate() }} disabled={release.isPending || !form.user_id || !form.password}
              className="rounded-xl bg-[#27AE60] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {release.isPending ? 'Releasing…' : 'Confirm & Release'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {eligible.length > 0 && (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#16A34A]" />
            <h2 className="font-semibold text-[#166534]">Eligible for Release</h2>
            <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">{eligible.length}</span>
          </div>
          <p className="mb-3 text-xs text-[#15803D]">Recipients who completed their required verified hours and have not been paid for the period.</p>
          <div className="space-y-2">
            {eligible.map((e) => (
              <div key={`${e.user_id}-${e.academic_year}-${e.semester}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#BBF7D0] bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1E293B]">{e.name}</p>
                  <p className="text-xs text-[#64748B]">{e.academic_year} — {e.semester} · {e.verified_hours}/{e.required_hours} hrs verified</p>
                </div>
                <button onClick={() => prefillRelease(e)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#27AE60] px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                  <Send className="h-3.5 w-3.5" /> Release {PHP.format(e.suggested_amount)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center"><DollarSign className="h-10 w-10 text-[#CBD5E1]" /><p className="text-sm text-[#94A3B8]">No stipend records.</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                {['Recipient', 'Control No.', 'Amount', 'Period', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r: StipendRecord) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending
                return (
                  <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 align-middle">
                    <td className="px-4 py-3 font-medium text-[#1E293B]">{r.recipient?.name ?? `User #${r.user_id}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{r.control_number ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#1B4F72]">{PHP.format(r.amount)}</td>
                    <td className="px-4 py-3 text-[#64748B]">{r.academic_year} — {r.semester}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      {r.status === 'void' && r.void_reason && <p className="mt-0.5 text-[11px] text-[#B0562F]">{r.void_reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'certified' && (
                        voiding?.id === r.id ? (
                          <div className="flex items-center gap-1.5">
                            <input autoFocus value={voiding.reason} onChange={e => setVoiding(v => v && ({ ...v, reason: e.target.value }))}
                              placeholder="Reason" className="w-32 rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs focus:outline-none" />
                            <button onClick={() => voiding.reason && voidStipend.mutate(voiding)} disabled={voidStipend.isPending || !voiding.reason}
                              className="rounded-lg bg-[#B0562F] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Void</button>
                            <button onClick={() => setVoiding(null)} className="text-xs text-[#94A3B8]">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setVoiding({ id: r.id, reason: '' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#EADFD4] px-2.5 py-1 text-xs font-semibold text-[#B0562F] hover:bg-[#FDF4F0]">
                            <Ban className="h-3.5 w-3.5" /> Void
                          </button>
                        )
                      )}
                      {r.status === 'claimed' && r.claimed_at && <span className="text-xs text-[#64748B]">Claimed {formatDate(r.claimed_at)}</span>}
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

const INPUT = 'w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#64748B]">{label}</label>
      {children}
    </div>
  )
}
