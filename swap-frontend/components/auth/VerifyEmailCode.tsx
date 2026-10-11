'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { CodeInput, ResendButton } from '@/components/auth/CodeInput'
import type { ApiError } from '@/types/api.types'

/**
 * "Check your email": the 6-digit code from registration. Used right after signing up and on
 * /verify-email (e.g. from the login page's "Enter my code"). Asks for the email when not given.
 */
export function VerifyEmailCode({ email: given, justSent = false }: { email?: string | null; justSent?: boolean }) {
  const router = useRouter()
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

  const verify = useMutation({
    mutationFn: () => authApi.verifyEmailCode(email.trim().toLowerCase(), code),
    onSuccess: () => router.replace('/login?verified=1'),
    onError: (err: ApiError) => setError(err.errors?.code?.[0] ?? err.errors?.email?.[0] ?? err.message ?? "That code isn't right."),
  })
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email.trim().toLowerCase()),
    onSuccess: () => { setWait(60); setError(null); setNote('If your account still needs verification, a new code is on its way.') },
  })

  const emailOk = /\S+@\S+\.\S+/.test(email)

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (emailOk && code.length === 6) { setError(null); verify.mutate() } }} className="text-left">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
        <MailCheck className="h-6 w-6 text-success-600" />
      </div>
      <h1 className="mt-4 text-center font-serif text-2xl font-medium text-ink-950">Check your email</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-500">
        {given
          ? <>We sent a 6-digit code to <span className="break-all font-semibold text-ink-950">{given}</span>. Enter it below to activate your account. It expires in 10 minutes.</>
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

      <button type="submit" disabled={!emailOk || code.length !== 6 || verify.isPending}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 text-sm font-semibold text-cream shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-60">
        {verify.isPending ? 'Checking…' : 'Verify my email'}
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/login" className="text-[13px] font-semibold text-ink-500 hover:text-ink-800">Back to sign in</Link>
        <ResendButton onResend={() => emailOk && resend.mutate()} pending={resend.isPending} seconds={wait} />
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-400">Can&apos;t find it? Check your spam or promotions folder.</p>
    </form>
  )
}
