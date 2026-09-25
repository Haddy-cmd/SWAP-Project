'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { X, LogOut } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import type { ApiError } from '@/types/api.types'

const schema = z.object({
  content: z.string().min(10, 'Please write at least 10 characters'),
  activities_done: z.string().min(10, 'Please write at least 10 characters'),
  challenges: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const TEXTAREA =
  'w-full rounded-xl border border-ink-300 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 resize-none'

interface NarrativeModalProps {
  logId: number
  /** Called once the narrative is saved — the caller then proceeds to clock out. */
  onSubmitted: () => void
  onClose: () => void
  /** External (clock-out) pending state, to keep the button busy through both steps. */
  clockingOut?: boolean
}

export function NarrativeModal({ logId, onSubmitted, onClose, clockingOut }: NarrativeModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const submit = useMutation({
    mutationFn: (data: FormData) => attendanceApi.submitNarrative(logId, data),
    onSuccess: () => onSubmitted(),
    onError: (err: ApiError) => {
      if (err.errors) {
        Object.entries(err.errors).forEach(([k, v]) => {
          if (k === 'content' || k === 'activities_done' || k === 'challenges') {
            setError(k, { message: v[0] })
          }
        })
      }
    },
  })

  const busy = submit.isPending || !!clockingOut

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">Narrative Report</h2>
            <p className="text-sm text-ink-500">Describe your work, then you&apos;ll be clocked out.</p>
          </div>
          <button onClick={onClose} className="text-ink-350 hover:text-danger-600 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => submit.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Summary of work done today</label>
            <textarea {...register('content')} rows={3} placeholder="Briefly describe your work session…" className={TEXTAREA} />
            {errors.content && <p className="mt-1 text-xs text-danger-600">{errors.content.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Specific activities done</label>
            <textarea {...register('activities_done')} rows={3} placeholder="List specific tasks, e.g., filing documents, encoding data…" className={TEXTAREA} />
            {errors.activities_done && <p className="mt-1 text-xs text-danger-600">{errors.activities_done.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">
              Challenges encountered <span className="font-normal text-ink-350">(optional)</span>
            </label>
            <textarea {...register('challenges')} rows={2} placeholder="Any difficulties or concerns…" className={TEXTAREA} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-danger-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-danger-700 disabled:opacity-60 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {busy ? 'Submitting…' : 'Submit & Clock Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
