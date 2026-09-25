'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
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

export default function NarrativePage() {
  const { logId } = useParams<{ logId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['narrative', logId],
    queryFn: () => attendanceApi.getNarrative(Number(logId)),
    retry: false,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const submit = useMutation({
    mutationFn: (data: FormData) => attendanceApi.submitNarrative(Number(logId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['narrative', logId] })
      // Refresh the open log so the attendance page knows the narrative is in and clock-out is unlocked.
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
      // Send the recipient to attendance to clock out now that the narrative is submitted.
      router.push('/recipient/attendance')
    },
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

  if (existing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink-900">Narrative Report</h1>
        <div className="rounded-2xl border border-success-600 bg-success-50 p-6">
          <p className="mb-4 font-semibold text-success-600">Report already submitted</p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink-900">Summary</dt>
              <dd className="mt-1 text-ink-500">{existing.content}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-900">Activities Done</dt>
              <dd className="mt-1 text-ink-500">{existing.activities_done}</dd>
            </div>
            {existing.challenges && (
              <div>
                <dt className="font-medium text-ink-900">Challenges</dt>
                <dd className="mt-1 text-ink-500">{existing.challenges}</dd>
              </div>
            )}
          </dl>
        </div>
        <Link
          href="/recipient/hours"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hours
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/recipient/hours"
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Submit Narrative Report</h1>
          <p className="text-sm text-ink-500">Required before clocking out</p>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit((d) => submit.mutate(d))} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">
              Summary of work done today
            </label>
            <textarea
              {...register('content')}
              rows={4}
              placeholder="Briefly describe your work session…"
              className={TEXTAREA}
            />
            {errors.content && (
              <p className="mt-1 text-xs text-danger-600">{errors.content.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">
              Specific activities done
            </label>
            <textarea
              {...register('activities_done')}
              rows={3}
              placeholder="List specific tasks, e.g., filing documents, encoding data…"
              className={TEXTAREA}
            />
            {errors.activities_done && (
              <p className="mt-1 text-xs text-danger-600">{errors.activities_done.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">
              Challenges encountered <span className="font-normal text-ink-350">(optional)</span>
            </label>
            <textarea
              {...register('challenges')}
              rows={2}
              placeholder="Any difficulties or concerns…"
              className={TEXTAREA}
            />
          </div>

          <button
            type="submit"
            disabled={submit.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            <Send className="h-4 w-4" />
            {submit.isPending ? 'Submitting…' : 'Submit Narrative'}
          </button>
        </form>
      </div>
    </div>
  )
}
