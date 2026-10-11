'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import { markLoginSplash } from '@/components/layout/LoginSplash'
import { CodeInput, ResendButton } from '@/components/auth/CodeInput'
import type { ApiError } from '@/types/api.types'

const GONE = /sign-up has expired/i

/**
 * "Check your email": the 6-digit code.
 * - mode "register" (right after the form): the code creates the account and signs the student in.
 * - mode "account" (/verify-email, accounts made before that): the code verifies, then they sign in.
 */
export function VerifyEmailCode({ email: given, justSent = false, mode = 'account', onRestart }: {
  email?: string | null
  justSent?: boolean
  mode?: 'register' | 'account'
  /** Register mode: back to the (still filled) form when the 30-minute hold has run out. */
  onRestart?: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState(given ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [wait, setWait] = useState(justSent ? 60 : 0)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const clean = () => email.trim().toLowerCase()
  const errorOf = (err: ApiError) =>
    err.errors?.code?.[0] ?? err.errors?.email?.[0] ?? err.errors?.student_id_number?.[0] ?? err.message ?? "That code isn't right."

  const verify = useMutation({
    mutationFn: async () => {
      if (mode === 'register') {
        const res = await authApi.confirmRegistration(clean(), code)
        markLoginSplash()
        queryClient.clear()
        setAuth(res.data, res.token)
        router.replace(getRoleDashboard(res.data.role))
        return
      }
      await authApi.verifyEmailCode(clean(), code)
      router.replace('/login?verified=1')
    },
    onError: (err: ApiError) => setError(errorOf(err)),
  })
  const resend = useMutation({
    mutationFn: () => (mode === 'register' ? authApi.resendRegistrationCode(clean()) : authApi.resendVerification(clean())),
    onSuccess: () => {
      setWait(60); setError(null)
      setNote(mode === 'register' ? 'We sent a new code.' : 'If your account still needs verification, a new code is on its way.')
    },
    onError: (err: ApiError) => setError(errorOf(err)),
  })

  const emailOk = /\S+@\S+\.\S+/.test(email)
  const gone = !!error && GONE.test(error)

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (emailOk && code.length === 6) { setError(null); verify.mutate() } }} className="text-left">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
        <MailCheck className="h-6 w-6 text-success-600" />
      </div>
      <h1 className="mt-4 text-center font-serif text-2xl font-medium text-ink-950">Check your email</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-500">
        {given
          ? mode === 'register'
            ? <>We sent a 6-digit code to <span className="break-all font-semibold text-ink-950">{given}</span>. Enter it to create your account. Each code lasts 10 minutes; your details are kept for 30.</>
            : <>We sent a 6-digit code to <span className="break-all font-semibold text-ink-950">{given}</span>. Enter it to activate your account. It expires in 10 minutes.</>
          : 'Enter your email and the 6-digit code we sent to it.'}
      </p>

      {!given && (
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@s.msumain.edu.ph"
            className="h-12 w-full rounded-xl border border-ink-200 bg-surface px-3.5 text-sm text-ink-900 placeholder-ink-350 focus:border-brand-700 focus:outline-none" />
        </label>
      )}

      <label className="mb-1.5 mt-5 block text-[12.5px] font-semibold text-ink-600">Verification code</label>
      <CodeInput value={code} onChange={(v) => { setCode(v); setError(null) }} invalid={!!error} disabled={verify.isPending} autoFocus={!!given} />
      {error && <p className="mt-1.5 text-xs text-danger-700">{error}</p>}
      {note && !error && <p className="mt-1.5 text-xs text-success-700">{note}</p>}

      {gone && onRestart ? (
        <button type="button" onClick={onRestart}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 text-sm font-semibold text-cream shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110">
          Fill in the form again
        </button>
      ) : (
        <button type="submit" disabled={!emailOk || code.length !== 6 || verify.isPending}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 text-sm font-semibold text-cream shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-60">
          {verify.isPending ? 'Checking…' : mode === 'register' ? 'Create my account' : 'Verify my email'}
        </button>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {mode === 'register' && onRestart
          ? <button type="button" onClick={onRestart} className="text-[13px] font-semibold text-ink-500 hover:text-ink-800">Change my details</button>
          : <Link href="/login" className="text-[13px] font-semibold text-ink-500 hover:text-ink-800">Back to sign in</Link>}
        <ResendButton onResend={() => emailOk && resend.mutate()} pending={resend.isPending} seconds={wait} />
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-400">Can&apos;t find it? Check your spam or promotions folder.</p>
    </form>
  )
}
