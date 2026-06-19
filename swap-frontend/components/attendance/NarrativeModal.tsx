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
  'w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/20 resize-none'

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
            <h2 className="font-semibold text-[#1E293B]">Narrative Report</h2>
            <p className="text-sm text-[#64748B]">Describe your work, then you&apos;ll be clocked out.</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => submit.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Summary of work done today</label>
            <textarea {...register('content')} rows={3} placeholder="Briefly describe your work session…" className={TEXTAREA} />
            {errors.content && <p className="mt-1 text-xs text-[#E74C3C]">{errors.content.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Specific activities done</label>
            <textarea {...register('activities_done')} rows={3} placeholder="List specific tasks, e.g., filing documents, encoding data…" className={TEXTAREA} />
            {errors.activities_done && <p className="mt-1 text-xs text-[#E74C3C]">{errors.activities_done.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Challenges encountered <span className="font-normal text-[#94A3B8]">(optional)</span>
            </label>
            <textarea {...register('challenges')} rows={2} placeholder="Any difficulties or concerns…" className={TEXTAREA} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
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
