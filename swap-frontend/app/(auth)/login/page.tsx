'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { ApiError } from '@/types/api.types'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

const INPUT =
  'w-full rounded-xl border border-[#E5DCD2] bg-[#FAF7F2] py-3 pl-11 pr-4 text-sm text-[#2B2522] placeholder-[#A99B92] transition-colors focus:border-[#7A1717] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7A1717]/10'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const login = useMutation({
    mutationFn: (data: FormData) => authApi.login(data),
    onSuccess: (res) => {
      setAuth(res.data, res.token)
      // Honor a ?redirect= target (e.g. returning to /scan after a QR deep link),
      // otherwise land on the role's default dashboard.
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      router.replace(redirect || getRoleDashboard(res.data.role))
    },
    onError: (err: ApiError) => {
      setServerError(err.message ?? 'Invalid credentials. Please try again.')
    },
  })

  return (
    <div className="rounded-2xl border border-[#E5DCD2] bg-white p-8 shadow-[0_12px_40px_-12px_rgba(92,16,16,0.18)] sm:p-9">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B8901F]">Welcome back</p>
        <h2 className="mt-2 font-serif text-3xl font-bold text-[#2B2522]">Sign in to your account</h2>
        <p className="mt-1.5 text-sm text-[#7A6E68]">Use your MSU credentials to continue.</p>
      </div>

      {serverError && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C0392B]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#3A322E]">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8901F]" />
            <input
              {...register('email')}
              type="email"
              placeholder="student@msumarawi.edu.ph"
              autoComplete="email"
              className={INPUT}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-[#C0392B]">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#3A322E]">Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8901F]" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className={cn(INPUT, 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A99B92] hover:text-[#7A1717] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-[#C0392B]">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#5A4F49]">
            <input type="checkbox" className="h-4 w-4 rounded accent-[#7A1717]" />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#7A1717] hover:text-[#A52020] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={login.isPending}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#7A1717] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5C1010] disabled:opacity-60 transition-colors"
        >
          {login.isPending ? 'Signing in…' : 'Sign In'}
          {!login.isPending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#ECE4D9]" />
        <span className="text-xs text-[#A99B92]">New here?</span>
        <div className="h-px flex-1 bg-[#ECE4D9]" />
      </div>

      <p className="text-center text-sm text-[#7A6E68]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-[#7A1717] hover:text-[#A52020] transition-colors">
          Register here
        </Link>
      </p>
    </div>
  )
}
