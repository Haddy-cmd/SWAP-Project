'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import type { ApiError } from '@/types/api.types'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const request = useMutation({
    mutationFn: (data: FormData) => authApi.forgotPassword(data.email),
    onSuccess: () => setSent(true),
    onError: (err: ApiError) => {
      setServerError(err.message ?? 'Something went wrong. Please try again.')
    },
  })

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle className="h-7 w-7 text-[#27AE60]" />
        </div>
        <h2 className="text-xl font-bold text-[#1E293B]">Check your email</h2>
        <p className="mt-2 text-sm text-[#8A6A6A]">
          We sent a password reset link to your email address. It expires in 60 minutes.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm">
      <Link
        href="/login"
        className="mb-6 flex items-center gap-1.5 text-sm text-[#8A6A6A] hover:text-[#7D1A1A] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1E293B]">Reset your password</h2>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {serverError && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#E74C3C]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => request.mutate(d))} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Email Address</label>
          <input
            {...register('email')}
            type="email"
            placeholder="student@msumarawi.edu.ph"
            className="w-full rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[#E74C3C]">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={request.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors"
        >
          <Mail className="h-4 w-4" />
          {request.isPending ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  )
}
