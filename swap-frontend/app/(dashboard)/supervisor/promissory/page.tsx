'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, CheckCircle, XCircle, Clock, Download, Loader2 } from 'lucide-react'
import { promissoryApi } from '@/lib/api/promissory.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { PromissoryNote, PromissoryStatus } from '@/types/promissory.types'

const TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUS: Record<PromissoryStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-yellow-50 text-[#F39C12]' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-[#27AE60]' },
  rejected: { label: 'Rejected', cls: 'bg-[#FDF0E9] text-[#B0562F]' },
}

export default function SupervisorPromissoryPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('')
  const [reviewing, setReviewing] = useState<PromissoryNote | null>(null)
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [lacking, setLacking] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-promissory', tab],
    queryFn: () => promissoryApi.getSupervisorQueue(tab || undefined),
  })
  const notes = data?.data ?? []

  const review = useMutation({
    mutationFn: () => promissoryApi.review(reviewing!.id, {
      action,
      lacking_hours: action === 'approve' ? Number(lacking) : undefined,
      review_remarks: remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor-promissory'] })
      setReviewing(null); setLacking(''); setRemarks(''); setError(null)
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setError(Object.values(e.response?.data?.errors ?? {}).flat()[0] ?? e.response?.data?.message ?? 'Could not save the review.'),
  })

  function openReview(n: PromissoryNote, a: 'approve' | 'reject') {
    setReviewing(n); setAction(a); setError(null)
    setLacking(n.lacking_hours != null ? String(n.lacking_hours) : '')
    setRemarks('')
  }

  async function download(n: PromissoryNote) {
    setDownloadingId(n.id)
    try {
      await promissoryApi.downloadSupervisorFile(n.id, n.file_name)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Promissory Notes</h1>
        <p className="mt-1 text-sm text-[#64748B]">Review promissory notes from students short on hours. Approving records the lacking hours they must render ASAP (deadline: 1 week after semester end).</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === t.key ? 'bg-[#1B4F72] text-white' : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-[#E2E8F0]" />)}</div>
      ) : !notes.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white py-16 text-center">
          <FileText className="h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#94A3B8]">No promissory notes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const meta = STATUS[n.status]
            return (
              <div key={n.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[#1E293B]">{n.student?.name ?? `User #${n.user_id}`}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      {n.status === 'approved' && n.overdue && (
                        <span className="rounded-full bg-[#FDF0E9] px-2.5 py-0.5 text-xs font-medium text-[#B0562F]">Deadline passed</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B]">{n.academic_year} · {n.semester} · submitted {formatDate(n.created_at)}</p>
                    <p className="mt-1 text-sm text-[#334155]">{n.reason}</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Lacking: <span className="font-semibold text-[#1B4F72]">{n.lacking_hours ?? '—'} hrs</span>
                      {n.makeup_deadline && <> · render ASAP by <span className="font-semibold">{formatDate(n.makeup_deadline)}</span></>}
                    </p>
                    {n.review_remarks && <p className="mt-1 text-xs italic text-[#64748B]">“{n.review_remarks}”</p>}
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <button onClick={() => download(n)} disabled={downloadingId === n.id}
                      className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1B4F72] hover:bg-[#F8FAFC] disabled:opacity-50">
                      {downloadingId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Document
                    </button>
                    {n.status === 'pending' && (
                      <>
                        <button onClick={() => openReview(n, 'approve')}
                          className="flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button onClick={() => openReview(n, 'reject')}
                          className="flex items-center gap-1.5 rounded-lg border border-[#EADFD4] px-3 py-2 text-xs font-semibold text-[#B0562F] hover:bg-[#FDF4F0]">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {reviewing?.id === n.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="text-xs font-semibold text-[#1E293B]">
                      {action === 'approve' ? 'Approve — record the lacking hours to render ASAP' : 'Reject — remarks required'}
                    </p>
                    {action === 'approve' && (
                      <input value={lacking} onChange={(e) => setLacking(e.target.value)} type="number" min="0" step="0.25"
                        placeholder="Lacking hours" className={INPUT} />
                    )}
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)}
                      placeholder={action === 'approve' ? 'Remarks (optional)' : 'Reason for rejection (required)'} className={INPUT} />
                    {error && <p className="text-sm text-[#C0392B]">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => review.mutate()}
                        disabled={review.isPending || (action === 'approve' && !lacking) || (action === 'reject' && !remarks)}
                        className="rounded-lg bg-[#1B4F72] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2980B9] disabled:opacity-50">
                        {review.isPending ? 'Saving…' : action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                      </button>
                      <button onClick={() => setReviewing(null)} className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-white">Cancel</button>
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
