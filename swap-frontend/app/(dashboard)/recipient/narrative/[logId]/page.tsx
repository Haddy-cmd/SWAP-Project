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
  'w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/20 resize-none'

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
        <h1 className="text-2xl font-bold text-[#1E293B]">Narrative Report</h1>
        <div className="rounded-2xl border border-[#27AE60] bg-green-50 p-6">
          <p className="mb-4 font-semibold text-[#27AE60]">Report already submitted</p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-[#1E293B]">Summary</dt>
              <dd className="mt-1 text-[#64748B]">{existing.content}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#1E293B]">Activities Done</dt>
              <dd className="mt-1 text-[#64748B]">{existing.activities_done}</dd>
            </div>
            {existing.challenges && (
              <div>
                <dt className="font-medium text-[#1E293B]">Challenges</dt>
                <dd className="mt-1 text-[#64748B]">{existing.challenges}</dd>
              </div>
            )}
          </dl>
        </div>
        <Link
          href="/recipient/hours"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B4F72] hover:text-[#2980B9] transition-colors"
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
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Submit Narrative Report</h1>
          <p className="text-sm text-[#64748B]">Required before clocking out</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit((d) => submit.mutate(d))} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Summary of work done today
            </label>
            <textarea
              {...register('content')}
              rows={4}
              placeholder="Briefly describe your work session…"
              className={TEXTAREA}
            />
            {errors.content && (
              <p className="mt-1 text-xs text-[#E74C3C]">{errors.content.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Specific activities done
            </label>
            <textarea
              {...register('activities_done')}
              rows={3}
              placeholder="List specific tasks, e.g., filing documents, encoding data…"
              className={TEXTAREA}
            />
            {errors.activities_done && (
              <p className="mt-1 text-xs text-[#E74C3C]">{errors.activities_done.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Challenges encountered <span className="font-normal text-[#94A3B8]">(optional)</span>
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B4F72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2980B9] disabled:opacity-60 transition-colors"
          >
            <Send className="h-4 w-4" />
            {submit.isPending ? 'Submitting…' : 'Submit Narrative'}
          </button>
        </form>
      </div>
    </div>
  )
}
