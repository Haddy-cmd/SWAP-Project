'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { ApiError } from '@/types/api.types'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

const FIELD =
  'flex h-[50px] items-center gap-2.5 rounded-xl border border-[#EADFD4] bg-white px-3.5 shadow-[0_1px_2px_rgba(60,30,25,0.04)] transition-colors focus-within:border-[#7C1B26]'
const INPUT = 'flex-1 border-none bg-transparent text-[14.5px] text-[#2B1E1B] placeholder-[#B7A99F] focus:outline-none'

const STATS = [
  ['500+', 'Recipients'],
  ['20+', 'Offices'],
  ['10+', 'Years'],
] as const

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
      // Honor a ?redirect= target (e.g. returning to /scan after a QR deep link).
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      router.replace(redirect || getRoleDashboard(res.data.role))
    },
    onError: (err: ApiError) => {
      setServerError(err.message ?? 'Invalid credentials. Please try again.')
    },
  })

  return (
    <div className="flex min-h-screen bg-[#F7F1EA]">
      {/* Form panel */}
      <div className="flex flex-1 flex-col bg-gradient-to-b from-[#FBF6EF] to-[#F5EDE3] px-6 py-10 sm:px-12 lg:flex-[1.32] lg:px-16">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          <Image src="/dsa-logo.png" alt="DSA Logo" width={40} height={40} priority />
          <div className="leading-tight">
            <p className="font-serif text-base font-semibold text-[#2B1E1B]">SWAP Portal</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#A38A82]">MSU — Marawi</p>
          </div>
        </div>

        {/* Centered form */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-[392px] py-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#A9823C]">Welcome back</p>
            <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-[#241715]">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-[#8A7A73]">Use your MSU credentials to continue.</p>

            {serverError && (
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C0392B]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit((d) => login.mutate(d))} className="mt-7">
              <label className="mb-[7px] block text-[12.5px] font-semibold text-[#5A4A45]">Email</label>
              <div className={FIELD}>
                <Mail className="h-5 w-5 flex-shrink-0 text-[#B79B7E]" />
                <input {...register('email')} type="email" placeholder="you@s.msumain.edu.ph" autoComplete="email" className={INPUT} />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-[#C0392B]">{errors.email.message}</p>}

              <label className="mb-[7px] mt-[18px] block text-[12.5px] font-semibold text-[#5A4A45]">Password</label>
              <div className={FIELD}>
                <Lock className="h-5 w-5 flex-shrink-0 text-[#B79B7E]" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[#A38A82] transition-colors hover:text-[#7C1B26]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-[#C0392B]">{errors.password.message}</p>}

              <div className="mb-6 mt-4 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#6E5F58]">
                  <input type="checkbox" className="h-[18px] w-[18px] rounded accent-[#7C1B26]" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-[13px] font-semibold text-[#7C1B26] hover:text-[#A52020] transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={login.isPending}
                className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-[15px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.28)] transition hover:brightness-110 disabled:opacity-60"
              >
                {login.isPending ? 'Signing in…' : 'Sign In'}
                {!login.isPending && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>

            <p className="mt-[22px] text-center text-[13.5px] text-[#8A7A73]">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-[#7C1B26] hover:text-[#A52020] transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11.5px] text-[#B6A79D]">Division of Students Affairs · dsa@msumain.edu.ph</p>
      </div>

      {/* Photo panel */}
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/campus.jpg)' }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(70,18,24,0.20) 0%, rgba(70,18,24,0.45) 58%, rgba(58,14,20,0.88) 100%), linear-gradient(160deg, rgba(108,21,29,0.55), rgba(64,12,18,0.55))',
          }}
        />
        <div className="absolute inset-x-11 bottom-11 z-10 text-[#FBEFE6]">
          <div className="font-serif text-2xl font-medium leading-snug tracking-tight">
            Mindanao State University
            <br />— Marawi
          </div>
          <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-[#FBEFE6]/80">
            Digital monitoring and application system for the Student Welfare Assistantship Program.
          </p>
          <div className="mt-5 flex gap-7 border-t border-[#F3D9A0]/28 pt-[18px]">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <div className="font-serif text-2xl font-semibold leading-none text-[#F3D9A0]">{value}</div>
                <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-[#FBEFE6]/70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
