'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
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
  'w-full rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15'

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
      router.replace(getRoleDashboard(res.data.role))
    },
    onError: (err: ApiError) => {
      setServerError(err.message ?? 'Invalid credentials. Please try again.')
    },
  })

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1E293B]">Sign in to SWAP</h2>
        <p className="mt-1 text-sm text-[#8A6A6A]">Enter your MSU credentials to continue</p>
      </div>

      {serverError && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#E74C3C]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="student@msumarawi.edu.ph"
            autoComplete="email"
            className={INPUT}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[#E74C3C]">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Password</label>
          <div className="relative">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B09A9A] hover:text-[#7D1A1A] transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-[#E74C3C]">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={login.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          {login.isPending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8A6A6A]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors">
          Register here
        </Link>
      </p>
    </div>
  )
}
