'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { reviewReason } from '@/lib/utils/attendanceReview'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { ApiRequestError } from '@/lib/api/axios'
import type { TimeLog } from '@/types/attendance.types'

const hrs = (v: number | string | null | undefined) => `${Math.round((Number(v) || 0) * 10) / 10}h`
const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'The student'
const shortDate = (d?: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''

/** Reject a log with the reason the student will see (the API requires one). */
export function RejectLogDialog({ log, studentName, onClose }: { log: TimeLog; studentName?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [reason, setReason] = useState('')
  const name = studentName ?? log.user?.name

  const reject = useMutation({
    mutationFn: (feedback: string) => attendanceApi.verifyLog(log.id, { action: 'rejected', feedback }),
    onSuccess: () => {
      notify({ title: `Log rejected · ${firstName(name)} is notified` })
      for (const key of ['supervisor-pending-logs', 'supervisor-students', 'verifications', 'student-logs', 'student-summary']) {
        qc.invalidateQueries({ queryKey: [key] })
      }
      onClose()
    },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not reject the log'),
  })

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !reject.isPending && onClose()}>
      <form className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (reason.trim()) reject.mutate(reason.trim()) }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-ink-950">Reject {hrs(log.duration_hours)} from {firstName(name)}?</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-500">{shortDate(log.date)} · {reviewReason(log) ?? log.office?.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X className="h-5 w-5" /></button>
        </div>
        <label htmlFor="reject-reason" className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-600">Why are you rejecting these hours?</label>
        <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} autoFocus
          placeholder="e.g. You weren't at the office at that time."
          className="w-full rounded-[11px] border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder-ink-350 focus:border-accent focus:outline-none" />
        <p className="mt-1 text-[11.5px] text-ink-400">The student sees this reason.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-[11px] border border-ink-200 px-4 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50">Cancel</button>
          <button type="submit" disabled={!reason.trim() || reject.isPending}
            className="h-10 rounded-[11px] bg-danger-700 px-4 text-[13.5px] font-semibold text-white hover:bg-danger-800 disabled:opacity-50">
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </div>
  )
}
