'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, Clock, Download, Lock, HandCoins, Ban, Loader2 } from 'lucide-react'
import { stipendApi } from '@/lib/api/stipend.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord, StipendStatus } from '@/types/analytics.types'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const STATUS: Record<StipendStatus, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  certified: { label: 'Ready to claim', cls: 'bg-[#EAF1F7] text-[#1B4F72]', Icon: HandCoins },
  claimed: { label: 'Received', cls: 'bg-green-50 text-[#27AE60]', Icon: CheckCircle },
  released: { label: 'Released', cls: 'bg-green-50 text-[#27AE60]', Icon: CheckCircle },
  void: { label: 'Void', cls: 'bg-[#FDF0E9] text-[#B0562F]', Icon: Ban },
  pending: { label: 'Pending', cls: 'bg-yellow-50 text-[#F39C12]', Icon: Clock },
}

export default function StipendPage() {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState<number | null>(null)
  const [form, setForm] = useState({ releasing_officer_name: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['stipend-history'],
    queryFn: () => stipendApi.getHistory(),
  })

  const totalReceived = history.filter((s) => s.status === 'claimed' || s.status === 'released')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0)

  async function downloadSlip(s: StipendRecord) {
    setDownloadingId(s.id)
    try {
      const blob = await stipendApi.getSlip(s.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `swap-claim-stub-${s.control_number ?? s.id}.pdf`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } finally {
      setDownloadingId(null)
    }
  }

  const confirmReceipt = useMutation({
    mutationFn: (id: number) => stipendApi.confirmReceipt(id, { ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stipend-history'] })
      setConfirming(null); setForm({ releasing_officer_name: '', password: '' })
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setError(e.response?.data?.errors?.password?.[0] ?? e.response?.data?.message ?? 'Could not confirm receipt.'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">My Stipend</h1>
        <p className="mt-1 text-sm text-[#64748B]">Download your claim slip and confirm receipt at the University Banking Office.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total Received" value={PHP.format(totalReceived)} />
        <Card label="Claim Stubs" value={String(history.length)} />
        <Card label="Ready to Claim" value={String(history.filter((s) => s.status === 'certified').length)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-[#E2E8F0]" />)}</div>
      ) : !history.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white py-16 text-center">
          <DollarSign className="h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#94A3B8]">No stipend records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((s) => {
            const meta = STATUS[s.status] ?? STATUS.pending
            const claimable = s.status === 'certified'
            return (
              <div key={s.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-[#1B4F72]">{PHP.format(Number(s.amount))}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#64748B]">
                      {[s.period_label, s.semester, s.academic_year].filter(Boolean).join(' · ')}
                    </p>
                    {s.control_number && <p className="mt-0.5 font-mono text-xs text-[#94A3B8]">{s.control_number}</p>}
                    {s.status === 'claimed' && s.claimed_at && <p className="mt-0.5 text-xs text-[#27AE60]">Received {formatDate(s.claimed_at)}</p>}
                    {s.status === 'void' && s.void_reason && <p className="mt-0.5 text-xs text-[#B0562F]">Void — {s.void_reason}</p>}
                  </div>

                  {s.has_slip && (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <button onClick={() => downloadSlip(s)} disabled={downloadingId === s.id}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1B4F72] hover:bg-[#F8FAFC] disabled:opacity-50">
                        {downloadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {s.status === 'claimed' ? 'Receiving Slip' : 'Claim Slip'}
                      </button>
                      {claimable && confirming !== s.id && (
                        <button onClick={() => { setError(null); setConfirming(s.id) }}
                          className="flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                          <CheckCircle className="h-3.5 w-3.5" /> Confirm Receipt
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {claimable && confirming === s.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="text-xs text-[#64748B]">Confirm only after you have received the cash at the Banking Office.</p>
                    <input value={form.releasing_officer_name} onChange={(e) => setForm((f) => ({ ...f, releasing_officer_name: e.target.value }))}
                      placeholder="Releasing officer / cashier name" className={INPUT} />
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                      <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Your password (to sign)" className={`${INPUT} pl-9`} />
                    </div>
                    {error && <p className="text-sm text-[#C0392B]">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setError(null); confirmReceipt.mutate(s.id) }}
                        disabled={confirmReceipt.isPending || !form.releasing_officer_name || !form.password}
                        className="rounded-lg bg-[#27AE60] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        {confirmReceipt.isPending ? 'Confirming…' : 'I received this stipend'}
                      </button>
                      <button onClick={() => setConfirming(null)} className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-white">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none'

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1B4F72]">{value}</p>
    </div>
  )
}
