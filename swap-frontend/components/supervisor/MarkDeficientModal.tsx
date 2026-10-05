'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatHours } from '@/lib/utils/formatHours'
import type { ApiRequestError } from '@/lib/api/axios'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

/**
 * A supervisor marks a student's current term deficient. The reason is required and
 * goes to the student (portal + email); the backend re-checks the hours are short.
 */
export function MarkDeficientModal({ studentId, studentName, term, shortfall, onClose }: {
  studentId: number
  studentName: string
  term: string
  shortfall: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { notify } = useFeedback()

  const mark = useMutation({
    mutationFn: () => attendanceApi.markDeficient(studentId, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-summary'] })
      qc.invalidateQueries({ queryKey: ['supervisor-students'] })
      qc.invalidateQueries({ queryKey: ['term-report'] })
      notify({ title: 'Marked deficient', detail: `${studentName} · ${term} · ${formatHours(shortfall)} short. They're notified with your reason.` })
      onClose()
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not mark the term deficient.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-5 w-5 text-danger-600" />
            <h2 className="font-semibold text-ink-900">Mark deficient</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-350 hover:text-danger-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-ink-600">
          Mark {studentName}&apos;s {term} service as deficient: <strong>{formatHours(shortfall)}</strong> short of the requirement.
          The student is told in the portal and by email, with your reason.
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink-700">Reason</span>
          <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} rows={4} maxLength={1000}
            placeholder="e.g. Stopped reporting to the office after midterms."
            className="mt-1 w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
        </label>
        {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={mark.isPending}
            className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
          <button onClick={() => mark.mutate()} disabled={reason.trim().length < 10 || mark.isPending}
            className="rounded-xl bg-danger-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {mark.isPending ? 'Saving…' : 'Mark deficient'}
          </button>
        </div>
      </div>
    </div>
  )
}
