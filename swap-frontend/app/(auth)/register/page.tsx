'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  User, Hash, Mail, Building2, BookOpen, GraduationCap, Lock, Contact,
  Eye, EyeOff, ArrowRight, ArrowLeft, Check, ChevronDown,
} from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { settingsApi } from '@/lib/api/settings.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { ApiError } from '@/types/api.types'

const schema = z
  .object({
    name: z.string().min(2, 'Full name is required'),
    email: z
      .string()
      .email('Enter a valid email')
      .refine((e) => e.toLowerCase().endsWith('@s.msumain.edu.ph'), {
        message: 'Use your institutional email to register',
      }),
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
const STEP2_FIELDS = ['college', 'program', 'year_level', 'password', 'password_confirmation'] as const

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

const STEP_META = [
  { title: 'Personal', sub: 'Name, ID & contact' },
  { title: 'Academic', sub: 'College & standing' },
  { title: 'Review', sub: 'Confirm & submit' },
]

const HEADINGS: Record<number, [string, string]> = {
  1: ['Personal Information', 'Enter your details exactly as they appear on University records.'],
  2: ['Academic Details', 'Tell us where you study and set a password for your account.'],
  3: ['Review & Submit', 'Confirm everything is correct before submitting your application.'],
}

const FIELD = 'flex h-12 items-center gap-2.5 rounded-[11px] border border-[#EADFD4] bg-white px-3.5 transition-colors focus-within:border-[#7C1B26]'
const INPUT = 'min-w-0 flex-1 border-none bg-transparent text-sm text-[#2B1E1B] placeholder-[#B7A99F] focus:outline-none'
const LABEL = 'mb-[7px] block text-[12.5px] font-semibold text-[#5A4A45]'
const ICON = 'h-[19px] w-[19px] flex-none text-[#B79B7E]'

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']

function StepDot({ index, step }: { index: number; step: number }) {
  const n = index + 1
  const done = step > n
  const active = step === n
  const on = done || active
  const meta = STEP_META[index]
  return (
    <div className="relative flex gap-4">
      <span
        className={`z-10 flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[15px] font-bold ${
          on ? 'bg-[#F3D9A0] text-[#651420]' : 'border-[1.5px] border-[#F3D9A0]/40 bg-[#F3D9A0]/10 text-[#E3B96E]'
        } ${active ? 'ring-4 ring-[#F3D9A0]/20' : ''}`}
      >
        {done ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : n}
      </span>
      <div>
        <div className={`text-[15px] font-bold ${on ? 'text-[#FFF8EE]' : 'text-[#FBEFE0]/70'}`}>{meta.title}</div>
        <div className="mt-0.5 text-xs text-[#FBEFE0]/55">{meta.sub}</div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState(1)
  const [showPw, setShowPw] = useState(false)
  const [certified, setCertified] = useState(false)
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
  const collegeLabel = COLLEGES.find((c) => c.value === selectedCollege)?.label ?? '—'
  const v = watch()

  // Registration follows the application period: no point signing up to apply
  // when applications are closed. (Login stays open for existing accounts.)
  const { data: appStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['application-status'],
    queryFn: () => settingsApi.getApplicationStatus(),
  })

  const signup = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: (res) => {
      setAuth(res.data, res.token)
      router.replace(getRoleDashboard(res.data.role))
    },
    onError: (err: ApiError) => {
      if (err.errors) {
        const mapped: Record<string, string> = {}
        Object.entries(err.errors).forEach(([k, val]) => (mapped[k] = val[0]))
        setFieldErrors(mapped)
        if (Object.keys(mapped).some((k) => (STEP1_FIELDS as readonly string[]).includes(k))) setStep(1)
        else if (Object.keys(mapped).some((k) => (STEP2_FIELDS as readonly string[]).includes(k))) setStep(2)
      }
      setServerError(err.message ?? 'Registration failed. Please try again.')
    },
  })

  const next = async () => {
    const fields = step === 1 ? STEP1_FIELDS : STEP2_FIELDS
    const ok = await trigger([...fields])
    if (ok) {
      setServerError(null)
      setStep((s) => Math.min(3, s + 1))
    }
  }

  const [heading, subhead] = HEADINGS[step]

  // Application period closed → show a notice instead of the signup form.
  if (!statusLoading && appStatus && !appStatus.open) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#EFE6DB] p-4 sm:p-8">
        <div className="w-full max-w-md rounded-[18px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(60,30,25,0.20)]">
          <Image src="/dsa-logo.png" alt="DSA Logo" width={64} height={64} className="mx-auto" priority />
          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E3E3]">
            <Lock className="h-6 w-6 text-[#7C1B26]" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-medium text-[#241715]">Registration is closed</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8A7A73]">
            {appStatus.message ?? 'The application period has not started yet. Please check back later.'}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/login" className="rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 py-3 text-sm font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110">
              Sign in to an existing account
            </Link>
            <Link href="/" className="rounded-xl border border-[#E7D9C9] bg-white px-6 py-3 text-sm font-semibold text-[#7C1B26] hover:bg-[#FBF7F2] transition-colors">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#EFE6DB] p-4 sm:p-8">
      <div className="flex w-full max-w-[1080px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_60px_rgba(60,30,25,0.20)] lg:h-[720px]">
        {/* Sidebar — vertical stepper */}
        <div className="hidden w-[316px] flex-none flex-col bg-gradient-to-b from-[#7C1B26] to-[#4E0F16] p-9 text-[#FBEFE0] lg:flex">
          <div className="mb-14 flex items-center gap-3">
            <Image src="/dsa-logo.png" alt="DSA Logo" width={40} height={40} priority />
            <div className="leading-tight">
              <p className="font-serif text-base font-semibold text-[#FFF8EE]">SWAP Portal</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#E3B96E]">MSU — Marawi</p>
            </div>
          </div>

          <div className="relative flex-1">
            {/* connecting line */}
            <div className="absolute left-[18px] top-4 bottom-10 w-0.5 bg-[#F3D9A0]/20" />
            <div className="space-y-9">
              {STEP_META.map((_, i) => (
                <StepDot key={i} index={i} step={step} />
              ))}
            </div>
          </div>

          <div className="text-xs text-[#FBEFE0]/60">
            Need help?
            <br />
            <span className="text-[#E3B96E]">dsa@msumain.edu.ph</span>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#FCF8F3] p-7 sm:p-12">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Step {step} of 3</div>
          <h2 className="mt-2 font-serif text-[29px] font-medium leading-tight text-[#241715]">{heading}</h2>
          <p className="mt-1.5 text-sm text-[#8A7A73]">{subhead}</p>

          {serverError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-[#C0392B]">{serverError}</div>
          )}

          <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="mt-6 flex flex-1 flex-col">
            <div className="flex-1">
              {/* STEP 1 — Personal */}
              {step === 1 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>First Name</label>
                    <div className={FIELD}><User className={ICON} /><input {...register('first_name')} placeholder="Juan" className={INPUT} /></div>
                    {(errors.first_name || fieldErrors.first_name) && <p className="mt-1 text-xs text-[#C0392B]">{errors.first_name?.message ?? fieldErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Last Name</label>
                    <div className={FIELD}><User className={ICON} /><input {...register('last_name')} placeholder="dela Cruz" className={INPUT} /></div>
                    {(errors.last_name || fieldErrors.last_name) && <p className="mt-1 text-xs text-[#C0392B]">{errors.last_name?.message ?? fieldErrors.last_name}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Full Name (as per records)</label>
                    <div className={FIELD}><Contact className={ICON} /><input {...register('name')} placeholder="Juan A. dela Cruz" className={INPUT} /></div>
                    {(errors.name || fieldErrors.name) && <p className="mt-1 text-xs text-[#C0392B]">{errors.name?.message ?? fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Student ID Number</label>
                    <div className={FIELD}><Hash className={ICON} /><input {...register('student_id_number')} placeholder="20XX-XXXXX" className={INPUT} /></div>
                    {(errors.student_id_number || fieldErrors.student_id_number) && <p className="mt-1 text-xs text-[#C0392B]">{errors.student_id_number?.message ?? fieldErrors.student_id_number}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Email Address</label>
                    <div className={FIELD}><Mail className={ICON} /><input {...register('email')} type="email" placeholder="student@s.msumain.edu.ph" className={INPUT} /></div>
                    {(errors.email || fieldErrors.email) && <p className="mt-1 text-xs text-[#C0392B]">{errors.email?.message ?? fieldErrors.email}</p>}
                  </div>
                </div>
              )}

              {/* STEP 2 — Academic */}
              {step === 2 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={LABEL}>College / Department</label>
                    <div className={FIELD}>
                      <Building2 className={ICON} />
                      <select {...register('college', { onChange: () => setValue('program', '') })} defaultValue="" className={`${INPUT} appearance-none`}>
                        <option value="" disabled>Select college</option>
                        {COLLEGES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <ChevronDown className="h-4 w-4 flex-none text-[#B79B7E]" />
                    </div>
                    {(errors.college || fieldErrors.college) && <p className="mt-1 text-xs text-[#C0392B]">{errors.college?.message ?? fieldErrors.college}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Course / Program</label>
                    <div className={FIELD}>
                      <BookOpen className={ICON} />
                      <select {...register('program')} defaultValue="" disabled={!selectedCollege} className={`${INPUT} appearance-none disabled:text-[#B7A99F]`}>
                        <option value="" disabled>{selectedCollege ? 'Select program' : 'Select college first'}</option>
                        {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="h-4 w-4 flex-none text-[#B79B7E]" />
                    </div>
                    {(errors.program || fieldErrors.program) && <p className="mt-1 text-xs text-[#C0392B]">{errors.program?.message ?? fieldErrors.program}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Year Level</label>
                    <div className={FIELD}>
                      <GraduationCap className={ICON} />
                      <select {...register('year_level')} defaultValue="" className={`${INPUT} appearance-none`}>
                        <option value="" disabled>Select year</option>
                        {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{ORDINAL[y]} Year</option>)}
                      </select>
                      <ChevronDown className="h-4 w-4 flex-none text-[#B79B7E]" />
                    </div>
                    {(errors.year_level || fieldErrors.year_level) && <p className="mt-1 text-xs text-[#C0392B]">{errors.year_level?.message ?? fieldErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Set Password</label>
                    <div className={FIELD}>
                      <Lock className={ICON} />
                      <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="new-password" className={INPUT} />
                      <button type="button" onClick={() => setShowPw((s) => !s)} className="text-[#A38A82] hover:text-[#7C1B26] transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                        {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {(errors.password || fieldErrors.password) && <p className="mt-1 text-xs text-[#C0392B]">{errors.password?.message ?? fieldErrors.password}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Confirm Password</label>
                    <div className={FIELD}>
                      <Lock className={ICON} />
                      <input {...register('password_confirmation')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="new-password" className={INPUT} />
                    </div>
                    {errors.password_confirmation && <p className="mt-1 text-xs text-[#C0392B]">{errors.password_confirmation.message}</p>}
                  </div>
                </div>
              )}

              {/* STEP 3 — Review */}
              {step === 3 && (
                <div>
                  <div className="overflow-hidden rounded-[14px] border border-[#EADFD4] bg-white">
                    {[
                      ['Full Name', v.name],
                      ['Student ID', v.student_id_number],
                      ['Email', v.email],
                      ['College', collegeLabel],
                      ['Program · Year', `${v.program || '—'} · ${v.year_level ? `${ORDINAL[Number(v.year_level)]} Year` : '—'}`],
                    ].map(([label, value], i, arr) => (
                      <div key={label} className={`flex items-center justify-between gap-4 px-5 py-[15px] ${i < arr.length - 1 ? 'border-b border-[#F0E6DA]' : ''}`}>
                        <span className="flex-none text-[13px] text-[#8A7A73]">{label}</span>
                        <span className="truncate text-right text-sm font-semibold text-[#2B1E1B]">{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <label className="mt-[18px] flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-[#6E5F58]">
                    <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-none rounded accent-[#7C1B26]" />
                    I certify that the information provided is accurate and complete.
                  </label>
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#EFE5DA] pt-5">
              {step === 1 ? (
                <span className="text-[13.5px] text-[#8A7A73]">
                  Already have an account?{' '}
                  <Link href="/login" className="font-bold text-[#7C1B26] hover:text-[#A52020] transition-colors">Sign in</Link>
                </span>
              ) : (
                <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex h-12 items-center gap-2 rounded-[11px] border border-[#E7D9C9] bg-white px-5 text-[14.5px] font-semibold text-[#7C1B26] hover:bg-[#FBF7F2] transition-colors">
                  <ArrowLeft className="h-[18px] w-[18px]" /> Back
                </button>
              )}

              {step < 3 ? (
                <button type="button" onClick={next} className="flex h-12 items-center gap-2 rounded-[11px] bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 text-[14.5px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110">
                  Continue <ArrowRight className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <button type="submit" disabled={signup.isPending || !certified} className="flex h-12 items-center gap-2 rounded-[11px] bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 text-[14.5px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110 disabled:opacity-50">
                  {signup.isPending ? 'Submitting…' : 'Submit Application'} <Check className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
