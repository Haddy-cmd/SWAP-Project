'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck, AlertCircle, Building2, Mail } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { UserRole } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'

const schema = z
  .object({
    name: z.string().min(2, 'Your name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormData = z.infer<typeof schema>

function AcceptInvitationForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const { setAuth } = useAuthStore()

  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authApi.getInvitation(token),
    enabled: !!token,
    retry: false,
  })

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Prefill the name the admin typed on the invitation, once it loads.
  useEffect(() => {
    if (invite?.name) setValue('name', invite.name)
  }, [invite, setValue])

  const accept = useMutation({
    mutationFn: (data: FormData) => authApi.acceptInvitation(token, data),
    onSuccess: (res) => {
      setAuth(res.data, res.token)
      router.replace(getRoleDashboard(res.data.role as UserRole))
    },
    onError: (err: ApiError) =>
      setServerError(err.message ?? 'Could not create your account. The invitation may have expired.'),
  })

  if (!token || isError) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle className="h-7 w-7 text-danger-600" />
        </div>
        <h2 className="font-serif text-xl font-bold text-ink-950">Invitation not valid</h2>
        <p className="mt-2 text-sm text-ink-500">
          This invitation link is invalid or has expired. Please ask the DSA admin to send a new one.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (isLoading || !invite) {
    return <div className="h-72 animate-pulse rounded-2xl bg-ink-200/60" />
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <ShieldCheck className="h-6 w-6 text-brand-700" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-ink-950">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          You&apos;ve been invited to the SWAP Portal as{' '}
          <span className="font-bold capitalize text-brand-700">{invite.role}</span>
          {invite.office && (
            <>
              {' '}for <span className="font-semibold">{invite.office}</span>
            </>
          )}
          .
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-1.5 rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
        <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-400" /> {invite.email}</span>
        {invite.office && (
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-ink-400" /> {invite.office}</span>
        )}
      </div>

      <form onSubmit={handleSubmit((d) => { setServerError(null); accept.mutate(d) })} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-950">Full Name</label>
          <input
            {...register('name')}
            placeholder="Prof. Juan Dela Cruz"
            className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3.5 py-2.5 text-sm focus:border-brand-700 focus:outline-none"
          />
          {errors.name && <p className="mt-1 text-xs text-danger-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-950">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 characters, mixed case + number"
              className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3.5 py-2.5 pr-11 text-sm focus:border-brand-700 focus:outline-none"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand-700">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-950">Confirm Password</label>
          <input
            {...register('password_confirmation')}
            type={showPw ? 'text' : 'password'}
            placeholder="Repeat your password"
            className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3.5 py-2.5 text-sm focus:border-brand-700 focus:outline-none"
          />
          {errors.password_confirmation && (
            <p className="mt-1 text-xs text-danger-600">{errors.password_confirmation.message}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={accept.isPending}
          className="w-full rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(22,69,43,.26)] hover:opacity-95 disabled:opacity-60 transition-opacity"
        >
          {accept.isPending ? 'Creating your account…' : 'Create Account & Sign In'}
        </button>
      </form>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-ink-200/60" />}>
      <AcceptInvitationForm />
    </Suspense>
  )
}
