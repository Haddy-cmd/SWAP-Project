'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { ApiError } from '@/types/api.types'

const schema = z
  .object({
    name: z.string().min(2, 'Full name is required'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
    student_id_number: z.string().min(1, 'Student ID is required'),
    first_name: z.string().min(1, 'Required'),
    middle_name: z.string().optional(),
    last_name: z.string().min(1, 'Required'),
    contact_number: z.string().optional(),
    college: z.string().min(1, 'College is required'),
    program: z.string().min(1, 'Program is required'),
    year_level: z.coerce.number().min(1).max(6),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormData = z.infer<typeof schema>

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-[#E74C3C]">{error}</p>}
    </div>
  )
}

const INPUT =
  'w-full rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15'

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const signup = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: (res) => {
      setAuth(res.data, res.token)
      router.replace(getRoleDashboard(res.data.role))
    },
    onError: (err: ApiError) => {
      if (err.errors) {
        const mapped: Record<string, string> = {}
        Object.entries(err.errors).forEach(([k, v]) => (mapped[k] = v[0]))
        setFieldErrors(mapped)
      }
      setServerError(err.message ?? 'Registration failed. Please try again.')
    },
  })

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1E293B]">Create your account</h2>
        <p className="mt-1 text-sm text-[#8A6A6A]">Apply for the SWAP program at MSU Marawi</p>
      </div>

      {serverError && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#E74C3C]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" error={errors.first_name?.message ?? fieldErrors.first_name}>
            <input {...register('first_name')} placeholder="Juan" className={INPUT} />
          </Field>
          <Field label="Last Name" error={errors.last_name?.message ?? fieldErrors.last_name}>
            <input {...register('last_name')} placeholder="dela Cruz" className={INPUT} />
          </Field>
        </div>

        <Field label="Full Name (as per records)" error={errors.name?.message ?? fieldErrors.name}>
          <input {...register('name')} placeholder="Juan A. dela Cruz" className={INPUT} />
        </Field>

        <Field label="Student ID Number" error={errors.student_id_number?.message ?? fieldErrors.student_id_number}>
          <input {...register('student_id_number')} placeholder="20XX-XXXXX" className={INPUT} />
        </Field>

        <Field label="Email Address" error={errors.email?.message ?? fieldErrors.email}>
          <input {...register('email')} type="email" placeholder="student@msumarawi.edu.ph" className={INPUT} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="College" error={errors.college?.message ?? fieldErrors.college}>
            <input {...register('college')} placeholder="e.g. CSET" className={INPUT} />
          </Field>
          <Field label="Program" error={errors.program?.message ?? fieldErrors.program}>
            <input {...register('program')} placeholder="e.g. BSCS" className={INPUT} />
          </Field>
        </div>

        <Field label="Year Level" error={errors.year_level?.message ?? fieldErrors.year_level}>
          <select {...register('year_level')} className={INPUT}>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>

        <Field label="Password" error={errors.password?.message ?? fieldErrors.password}>
          <input {...register('password')} type="password" placeholder="••••••••" autoComplete="new-password" className={INPUT} />
        </Field>

        <Field label="Confirm Password" error={errors.password_confirmation?.message}>
          <input {...register('password_confirmation')} type="password" placeholder="••••••••" autoComplete="new-password" className={INPUT} />
        </Field>

        <button
          type="submit"
          disabled={signup.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          {signup.isPending ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8A6A6A]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
