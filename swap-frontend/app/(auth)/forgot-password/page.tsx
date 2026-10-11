'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import type { ApiError } from '@/types/api.types'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const request = useMutation({
    mutationFn: (data: FormData) => authApi.forgotPassword(data.email),
    // Same reply whether or not the email has an account; continue to the code + new password step.
    onSuccess: (_r, d) => router.push(`/reset-password?email=${encodeURIComponent(d.email.trim().toLowerCase())}&sent=1`),
    onError: (err: ApiError) => {
      setServerError(err.message ?? 'Something went wrong. Please try again.')
    },
  })

  if (sent) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-surface p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
          <CheckCircle className="h-7 w-7 text-success-600" />
        </div>
        <h2 className="text-xl font-bold text-ink-900">Check your email</h2>
        <p className="mt-2 text-sm text-ink-500">
          If an account uses this email, we sent a code to it.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-8 shadow-sm">
      <Link
        href="/login"
        className="mb-6 flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink-900">Reset your password</h2>
        <p className="mt-1 text-sm text-ink-500">
          Enter your email and we&apos;ll send you a 6-digit code.
        </p>
      </div>

      {serverError && (
        <div className="mb-5 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => request.mutate(d))} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">Email Address</label>
          <input
            {...register('email')}
            type="email"
            placeholder="student@msumarawi.edu.ph"
            className="w-full rounded-xl border border-ink-300 bg-surface px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={request.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
        >
          <Mail className="h-4 w-4" />
          {request.isPending ? 'Sending…' : 'Send me a code'}
        </button>
      </form>
    </div>
  )
}
