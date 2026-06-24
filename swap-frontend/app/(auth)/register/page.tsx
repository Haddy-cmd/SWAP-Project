'use client'

import Link from 'next/link'
import { forwardRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  User, Contact, Hash, Mail, Building2, BookOpen, GraduationCap, Lock,
  Eye, EyeOff, ArrowRight, ArrowLeft, Check, ChevronDown, UserPlus, type LucideIcon,
} from 'lucide-react'
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

const STEP1_FIELDS = ['first_name', 'last_name', 'name', 'student_id_number', 'email'] as const

/** Colleges of MSU Main Campus, Marawi City, and the programs they offer there.
 *  Value (abbreviation) is what gets stored. */
const COLLEGES: { value: string; label: string; programs: string[] }[] = [
  { value: 'CA', label: 'College of Agriculture', programs: ['BS Agriculture', 'BS Agribusiness', 'BS Food Technology', 'BS Agricultural and Biosystems Engineering'] },
  { value: 'CBAA', label: 'College of Business Administration and Accountancy', programs: ['BS Accountancy', 'BS Business Administration', 'BS Management Accounting', 'BS Entrepreneurship', 'BS Office Administration'] },
  { value: 'CED', label: 'College of Education', programs: ['Bachelor of Elementary Education', 'Bachelor of Secondary Education', 'Bachelor of Early Childhood Education', 'Bachelor of Special Needs Education'] },
  { value: 'CoE', label: 'College of Engineering', programs: ['BS Civil Engineering', 'BS Electrical Engineering', 'BS Mechanical Engineering', 'BS Electronics Engineering', 'BS Computer Engineering', 'BS Chemical Engineering', 'BS Geodetic Engineering'] },
  { value: 'CF', label: 'College of Fisheries', programs: ['BS Fisheries'] },
  { value: 'CFES', label: 'College of Forestry and Environmental Studies', programs: ['BS Forestry', 'BS Environmental Science'] },
  { value: 'CHS', label: 'College of Health Sciences', programs: ['BS Nursing', 'BS Midwifery'] },
  { value: 'CHTM', label: 'College of Hospitality and Tourism Management', programs: ['BS Hospitality Management', 'BS Tourism Management'] },
  { value: 'CICS', label: 'College of Information and Computing Sciences', programs: ['BS Computer Science', 'BS Information Technology', 'BS Information Systems'] },
  { value: 'LAW', label: 'College of Law', programs: ['Juris Doctor'] },
  { value: 'CM', label: 'College of Medicine', programs: ['Doctor of Medicine'] },
  { value: 'CNSM', label: 'College of Natural Sciences and Mathematics', programs: ['BS Biology', 'BS Chemistry', 'BS Physics', 'BS Mathematics', 'BS Statistics'] },
  { value: 'CPA', label: 'College of Public Affairs', programs: ['Bachelor of Public Administration', 'BS Social Work'] },
  { value: 'CSSH', label: 'College of Social Sciences and Humanities', programs: ['AB English', 'AB Political Science', 'BS Psychology', 'AB Sociology', 'AB History', 'AB Economics', 'AB Communication', 'AB Philosophy'] },
  { value: 'CSPEAR', label: 'College of Sports, Physical Education and Recreation', programs: ['Bachelor of Physical Education', 'BS Exercise and Sports Sciences'] },
  { value: 'KFCIAAS', label: 'King Faisal Center for Islamic, Arabic and Asian Studies', programs: ['AB Islamic Studies', 'AB Arabic Language', 'BS Islamic Studies'] },
]

const INPUT =
  'w-full rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15 disabled:bg-[#FAF7F7] disabled:text-[#B09A9A]'
const ICON = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B09A9A]'

const STRENGTH = [
  { label: 'Too weak', bar: 'bg-[#E74C3C]', text: 'text-[#E74C3C]' },
  { label: 'Weak', bar: 'bg-[#E74C3C]', text: 'text-[#E74C3C]' },
  { label: 'Fair', bar: 'bg-[#F39C12]', text: 'text-[#D97706]' },
  { label: 'Good', bar: 'bg-[#2980B9]', text: 'text-[#2980B9]' },
  { label: 'Strong', bar: 'bg-[#27AE60]', text: 'text-[#1E8E50]' },
]

function passwordScore(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-[#E74C3C]">{error}</p>}
    </div>
  )
}

const IconInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }>(
  ({ icon: Icon, className, ...props }, ref) => (
    <div className="relative">
      <Icon className={ICON} />
      <input ref={ref} {...props} className={`${INPUT} pl-11 ${className ?? ''}`} />
    </div>
  )
)
IconInput.displayName = 'IconInput'

function StepDot({ n, state, label }: { n: number; state: 'done' | 'active' | 'idle'; label: string }) {
  const dot =
    state === 'done' ? 'bg-[#27AE60] text-white'
    : state === 'active' ? 'bg-[#7D1A1A] text-white'
    : 'bg-[#F1EBE4] text-[#B8AFA8] border border-[#E0D6CE]'
  const text = state === 'idle' ? 'text-[#B8AFA8] font-medium' : 'text-[#7D1A1A] font-semibold'
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${dot}`}>
        {state === 'done' ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={`text-xs ${text}`}>{label}</span>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState(1)
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedCollege = watch('college')
  const programs = COLLEGES.find((c) => c.value === selectedCollege)?.programs ?? []
  const pw = watch('password') ?? ''
  const score = passwordScore(pw)
  const meta = STRENGTH[score]

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
        // If a server error belongs to step 1, send the user back to fix it.
        if (Object.keys(mapped).some((k) => (STEP1_FIELDS as readonly string[]).includes(k))) setStep(1)
      }
      setServerError(err.message ?? 'Registration failed. Please try again.')
    },
  })

  const next = async () => {
    const ok = await trigger([...STEP1_FIELDS])
    if (ok) {
      setServerError(null)
      setStep(2)
    }
  }

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1E293B]">Create your account</h2>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          {step === 1 ? 'Apply for the SWAP program at MSU Marawi' : 'Almost done — your academic details'}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        <StepDot n={1} state={step > 1 ? 'done' : 'active'} label="Personal" />
        <div className={`mx-3 h-0.5 flex-1 rounded-full ${step > 1 ? 'bg-[#7D1A1A]' : 'bg-[#E5E0DA]'}`} />
        <StepDot n={2} state={step === 2 ? 'active' : 'idle'} label="Academic" />
      </div>

      {serverError && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#E74C3C]">{serverError}</div>
      )}

      <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="space-y-4">
        {step === 1 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First Name" error={errors.first_name?.message ?? fieldErrors.first_name}>
                <IconInput icon={User} {...register('first_name')} placeholder="Juan" />
              </Field>
              <Field label="Last Name" error={errors.last_name?.message ?? fieldErrors.last_name}>
                <IconInput icon={User} {...register('last_name')} placeholder="dela Cruz" />
              </Field>
            </div>

            <Field label="Full Name (as per records)" error={errors.name?.message ?? fieldErrors.name}>
              <IconInput icon={Contact} {...register('name')} placeholder="Juan A. dela Cruz" />
            </Field>

            <Field label="Student ID Number" error={errors.student_id_number?.message ?? fieldErrors.student_id_number}>
              <IconInput icon={Hash} {...register('student_id_number')} placeholder="20XX-XXXXX" />
            </Field>

            <Field label="Email Address" error={errors.email?.message ?? fieldErrors.email}>
              <IconInput icon={Mail} type="email" {...register('email')} placeholder="student@msumarawi.edu.ph" />
            </Field>

            <button
              type="button"
              onClick={next}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="College" error={errors.college?.message ?? fieldErrors.college}>
                <div className="relative">
                  <Building2 className={ICON} />
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A6A]" />
                  <select
                    {...register('college', { onChange: () => setValue('program', '') })}
                    defaultValue=""
                    className={`${INPUT} appearance-none pl-11 pr-10`}
                  >
                    <option value="" disabled>Select college</option>
                    {COLLEGES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Program" error={errors.program?.message ?? fieldErrors.program}>
                <div className="relative">
                  <BookOpen className={ICON} />
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A6A]" />
                  <select
                    {...register('program')}
                    defaultValue=""
                    disabled={!selectedCollege}
                    className={`${INPUT} appearance-none pl-11 pr-10`}
                  >
                    <option value="" disabled>{selectedCollege ? 'Select program' : 'Select college first'}</option>
                    {programs.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>

            <Field label="Year Level" error={errors.year_level?.message ?? fieldErrors.year_level}>
              <div className="relative">
                <GraduationCap className={ICON} />
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A6A]" />
                <select {...register('year_level')} className={`${INPUT} appearance-none pl-11 pr-10`}>
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Password" error={errors.password?.message ?? fieldErrors.password}>
              <div className="relative">
                <Lock className={ICON} />
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${INPUT} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A6A6A] hover:text-[#7D1A1A] transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pw && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? meta.bar : 'bg-[#EDE3E0]'}`} />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs font-medium ${meta.text}`}>{meta.label}</p>
                </div>
              )}
            </Field>

            <Field label="Confirm Password" error={errors.password_confirmation?.message}>
              <div className="relative">
                <Lock className={ICON} />
                <input
                  {...register('password_confirmation')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${INPUT} pl-11`}
                />
              </div>
            </Field>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#DCC5C5] px-5 py-3 text-sm font-semibold text-[#7D1A1A] hover:bg-[#FAF7F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={signup.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                {signup.isPending ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </>
        )}
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
