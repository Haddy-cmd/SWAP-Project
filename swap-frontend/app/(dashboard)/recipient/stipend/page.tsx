'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, Clock, Download, HandCoins, Ban, Loader2, FileText, Upload } from 'lucide-react'
import { stipendApi } from '@/lib/api/stipend.api'
import { promissoryApi } from '@/lib/api/promissory.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord, StipendStatus } from '@/types/analytics.types'
import type { PromissoryStatus } from '@/types/promissory.types'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const STATUS: Record<StipendStatus, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  certified: { label: 'Ready to claim', cls: 'bg-info-50 text-brand-700', Icon: HandCoins },
  claimed: { label: 'Received', cls: 'bg-success-50 text-success-600', Icon: CheckCircle },
  released: { label: 'Released', cls: 'bg-success-50 text-success-600', Icon: CheckCircle },
  void: { label: 'Void', cls: 'bg-danger-50 text-danger-700', Icon: Ban },
  pending: { label: 'Pending', cls: 'bg-warning-50 text-warning-600', Icon: Clock },
}

const PROMISSORY_STATUS: Record<PromissoryStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-warning-50 text-warning-600' },
  approved: { label: 'Approved', cls: 'bg-success-50 text-success-600' },
  rejected: { label: 'Rejected', cls: 'bg-danger-50 text-danger-700' },
}

export default function StipendPage() {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState<number | null>(null)
  const [form, setForm] = useState({ releasing_officer_name: '' })
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['stipend-history'],
    queryFn: () => stipendApi.getHistory(),
  })

  const { data: promissory } = useQuery({
    queryKey: ['promissory-mine'],
    queryFn: () => promissoryApi.getMine(),
  })
  const notes = promissory?.notes ?? []
  const submission = promissory?.submission

  const [reason, setReason] = useState('')
  const [doc, setDoc] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitPromissory = useMutation({
    mutationFn: () => promissoryApi.submit(submission!.assignment_id!, reason, doc!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promissory-mine'] })
      setReason(''); setDoc(null); setSubmitError(null)
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setSubmitError(Object.values(e.response?.data?.errors ?? {}).flat()[0] ?? e.response?.data?.message ?? 'Could not submit.'),
  })

  const totalReceived = history.filter((s) => s.status === 'claimed' || s.status === 'released')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0)

  async function downloadSlip(s: StipendRecord) {
    setDownloadingId(s.id)
    try {
      // Versioned by lifecycle timestamps so a post-confirm download can never
      // serve the pre-confirm bytes from cache.
      const blob = await stipendApi.getSlip(s.id, s.claimed_at ?? s.certified_at ?? s.created_at)
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
      setConfirming(null); setForm({ releasing_officer_name: '' })
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setError(e.response?.data?.message ?? 'Could not confirm receipt.'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Stipend</h1>
        <p className="mt-1 text-sm text-ink-500">Download your claim slip and confirm receipt at the University Banking Office.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total Received" value={PHP.format(totalReceived)} />
        <Card label="Claim Stubs" value={String(history.length)} />
        <Card label="Ready to Claim" value={String(history.filter((s) => s.status === 'certified').length)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-ink-200" />)}</div>
      ) : !history.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-200 bg-white py-16 text-center">
          <DollarSign className="h-10 w-10 text-ink-300" />
          <p className="text-sm font-medium text-ink-350">No stipend records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((s) => {
            const meta = STATUS[s.status] ?? STATUS.pending
            const claimable = s.status === 'certified'
            return (
              <div key={s.id} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-brand-700">{PHP.format(Number(s.amount))}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {[s.period_label, s.semester, s.academic_year].filter(Boolean).join(' · ')}
                    </p>
                    {s.control_number && <p className="mt-0.5 font-mono text-xs text-ink-350">{s.control_number}</p>}
                    {s.status === 'claimed' && s.claimed_at && <p className="mt-0.5 text-xs text-success-600">Received {formatDate(s.claimed_at)}</p>}
                    {s.status === 'void' && s.void_reason && <p className="mt-0.5 text-xs text-danger-700">Void — {s.void_reason}</p>}
                  </div>

                  {s.has_slip && (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <button onClick={() => downloadSlip(s)} disabled={downloadingId === s.id}
                        className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-50">
                        {downloadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {s.status === 'claimed' ? 'Receiving Slip' : 'Claim Slip'}
                      </button>
                      {claimable && confirming !== s.id && (
                        <button onClick={() => { setError(null); setConfirming(s.id) }}
                          className="flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-2 text-xs font-semibold text-white hover:bg-success-700">
                          <CheckCircle className="h-3.5 w-3.5" /> Confirm Receipt
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {claimable && confirming === s.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
                    <p className="text-xs text-ink-500">Confirm only after you have received the cash at the Banking Office.</p>
                    <input value={form.releasing_officer_name} onChange={(e) => setForm((f) => ({ ...f, releasing_officer_name: e.target.value }))}
                      placeholder="Releasing officer / cashier name" className={INPUT} />
                    {error && <p className="text-sm text-danger-700">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setError(null); confirmReceipt.mutate(s.id) }}
                        disabled={confirmReceipt.isPending || !form.releasing_officer_name}
                        className="rounded-lg bg-success-600 px-4 py-2 text-xs font-semibold text-white hover:bg-success-700 disabled:opacity-50">
                        {confirmReceipt.isPending ? 'Confirming…' : 'I received this stipend'}
                      </button>
                      <button onClick={() => setConfirming(null)} className="rounded-lg border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-500 hover:bg-white">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-700" />
          <h2 className="font-semibold text-ink-900">Promissory Note</h2>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Short on hours after the semester ended? Upload a promissory note — once your supervisor approves it and records the lacking hours, the admin can release your stipend.
        </p>

        {submission?.can_submit ? (
          <div className="mt-3 space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
            <p className="text-xs text-ink-500">
              Lacking: <span className="font-semibold text-brand-700">{submission.lacking_hours} hrs</span> — to be rendered ASAP (deadline: 1 week after semester end).
            </p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Why did you fall short, and when will you render the lacking hours?"
              className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-500 hover:bg-ink-50">
              <Upload className="h-4 w-4" />
              {doc ? doc.name : 'Attach promissory document (PDF/JPG/PNG, max 5MB)'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => setDoc(e.target.files?.[0] ?? null)} />
            </label>
            {submitError && <p className="text-sm text-danger-700">{submitError}</p>}
            <button onClick={() => { setSubmitError(null); submitPromissory.mutate() }}
              disabled={submitPromissory.isPending || !reason.trim() || !doc}
              className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {submitPromissory.isPending ? 'Submitting…' : 'Submit promissory note'}
            </button>
          </div>
        ) : submission?.reason ? (
          <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">{submission.reason}</p>
        ) : null}

        {notes.length > 0 && (
          <div className="mt-3 space-y-2">
            {notes.map((n) => {
              const meta = PROMISSORY_STATUS[n.status]
              return (
                <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                    <p className="mt-1 text-xs text-ink-500">
                      Lacking {n.lacking_hours ?? '—'} hrs
                      {n.makeup_deadline && <> · render ASAP by {formatDate(n.makeup_deadline)}</>}
                      {n.status === 'approved' && n.overdue && <span className="font-semibold text-danger-700"> · deadline passed</span>}
                    </p>
                    {n.review_remarks && <p className="text-xs italic text-ink-500">“{n.review_remarks}”</p>}
                  </div>
                  <button onClick={() => promissoryApi.downloadFile(n.id, n.file_name)}
                    className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-ink-50">
                    <Download className="h-3.5 w-3.5" /> Document
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700">{value}</p>
    </div>
  )
}
