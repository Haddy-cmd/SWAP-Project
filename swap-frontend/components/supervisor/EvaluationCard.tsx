'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import type { TermEvaluation } from '@/types/application.types'

const RATINGS = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Satisfactory' },
  { value: 4, label: 'Very good' },
  { value: 5, label: 'Excellent' },
] as const

const PASSING = 3

/**
 * The supervisor's end-of-term evaluation (1 Poor … 5 Excellent, 3+ passes). The DSA
 * needs a passed one before approving the student's renewal. Editable while the
 * placement is current.
 */
export function EvaluationCard({ assignmentId, evaluation }: { assignmentId: number; evaluation: TermEvaluation | null }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState<number | null>(evaluation?.rating ?? null)
  const [remarks, setRemarks] = useState(evaluation?.remarks ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setRating(evaluation?.rating ?? null)
    setRemarks(evaluation?.remarks ?? '')
  }, [evaluation?.rating, evaluation?.remarks])

  const save = useMutation({
    mutationFn: () => attendanceApi.saveEvaluation(assignmentId, { rating: rating!, remarks: remarks.trim() }),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['student-summary'] })
      qc.invalidateQueries({ queryKey: ['supervisor-students'] })
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not save the evaluation.'),
  })

  const changed = rating !== (evaluation?.rating ?? null) || remarks.trim() !== (evaluation?.remarks ?? '')

  return (
    <div className="mt-[18px] rounded-[18px] border border-ink-200 bg-white px-7 py-[22px] shadow-[0_2px_10px_rgba(19,36,26,.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">End-of-Term Evaluation</div>
        {evaluation && (
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold',
            evaluation.passed ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>
            {evaluation.passed ? 'Passed' : 'Did not pass'} · {evaluation.rating}/5
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-500">
        Rate the student&apos;s service this term. A rating of {PASSING} or higher passes; the DSA needs a passed evaluation to approve their renewal.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Rating">
        {RATINGS.map((r) => (
          <button key={r.value} role="radio" aria-checked={rating === r.value}
            onClick={() => { setRating(r.value); setSaved(false); setError(null) }}
            className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
              rating === r.value
                ? r.value >= PASSING ? 'border-success-600 bg-success-50 text-success-800' : 'border-danger-600 bg-danger-50 text-danger-700'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
            <Star className={cn('h-3.5 w-3.5', rating !== null && r.value <= rating ? 'fill-current' : '')} />
            {r.value} · {r.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-semibold text-ink-700">Remarks</span>
        <textarea value={remarks} onChange={(e) => { setRemarks(e.target.value); setSaved(false); setError(null) }} rows={3} maxLength={2000}
          placeholder="How did the student perform this term?"
          className="mt-1 w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
      </label>

      {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
      {saved && !changed && <p className="mt-2 text-sm font-medium text-success-700">Evaluation saved.</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-400">
          {evaluation?.updated_at ? `Last saved ${formatDateTime(evaluation.updated_at)}${evaluation.evaluator ? ` by ${evaluation.evaluator}` : ''}` : 'Not evaluated yet'}
        </span>
        <button onClick={() => save.mutate()} disabled={rating === null || !remarks.trim() || !changed || save.isPending}
          className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {save.isPending ? 'Saving…' : evaluation ? 'Update evaluation' : 'Save evaluation'}
        </button>
      </div>
    </div>
  )
}
