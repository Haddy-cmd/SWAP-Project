'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import type { ApiError } from '@/types/api.types'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormData = z.infer<typeof schema>

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [showPw, setShowPw] = useState(false)
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const reset = useMutation({
    mutationFn: (data: FormData) =>
      authApi.resetPassword({ token, email, password: data.password, password_confirmation: data.password_confirmation }),
    onSuccess: () => {
      setDone(true)
      setTimeout(() => router.replace('/login'), 2500)
    },
    onError: (err: ApiError) => setServerError(err.message ?? 'Could not reset your password. The link may have expired.'),
  })

  if (done) {
    return (
      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle className="h-7 w-7 text-[#27AE60]" />
        </div>
        <h2 className="font-serif text-xl font-bold text-[#241715]">Password updated</h2>
        <p className="mt-2 text-sm text-[#8A7A73]">Redirecting you to sign in…</p>
      </div>
    )
  }

  // Guard against a malformed link missing its token/email.
  const invalidLink = !token || !email

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm">
      <Link href="/login" className="mb-6 flex items-center gap-1.5 text-sm text-[#8A7A73] hover:text-[#7C1B26] transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <div className="mb-6">
        <h2 className="font-serif text-2xl font-bold text-[#241715]">Set a new password</h2>
        <p className="mt-1 text-sm text-[#8A7A73]">
          {email ? <>For <span className="font-medium text-[#5A4A45]">{email}</span></> : 'Choose a new password for your account.'}
        </p>
      </div>

      {invalidLink && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#B45309]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          This reset link is invalid or incomplete. Please request a new one.
        </div>
      )}

      {serverError && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C0392B]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => reset.mutate(d))} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#5A4A45]">New Password</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3.5 py-2.5 focus-within:border-[#7C1B26]">
            <Lock className="h-4 w-4 flex-shrink-0 text-[#B79B7E]" />
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="flex-1 border-none bg-transparent text-sm text-[#2B1E1B] placeholder-[#B7A99F] focus:outline-none"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="text-[#A38A82] hover:text-[#7C1B26]" aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-[#C0392B]">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#5A4A45]">Confirm Password</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3.5 py-2.5 focus-within:border-[#7C1B26]">
            <Lock className="h-4 w-4 flex-shrink-0 text-[#B79B7E]" />
            <input
              {...register('password_confirmation')}
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="flex-1 border-none bg-transparent text-sm text-[#2B1E1B] placeholder-[#B7A99F] focus:outline-none"
            />
          </div>
          {errors.password_confirmation && <p className="mt-1 text-xs text-[#C0392B]">{errors.password_confirmation.message}</p>}
        </div>

        <button
          type="submit"
          disabled={reset.isPending || invalidLink}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 py-3 text-sm font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110 disabled:opacity-60"
        >
          {reset.isPending ? 'Updating…' : 'Reset Password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/60" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
