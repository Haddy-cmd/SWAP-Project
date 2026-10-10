'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  User, Hash, Mail, Building2, BookOpen, GraduationCap, Lock, Contact,
  Eye, EyeOff, ArrowRight, ArrowLeft, Check, ChevronDown, MailCheck,
} from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { settingsApi } from '@/lib/api/settings.api'
import type { ApiError } from '@/types/api.types'
import { strongPassword } from '@/lib/utils/password'
import { PasswordGuide } from '@/components/auth/PasswordGuide'

/** Only MSU Main Campus student addresses may register. Mirrors RegisterRequest::EMAIL_DOMAIN. */
const EMAIL_DOMAIN = '@s.msumain.edu.ph'

/** Letters (incl. ñ/Ñ and accented forms), spaces, hyphens, apostrophes, periods. */
const NAME_RE = /^[\p{L}\p{M}\-'. ]+$/u

const NAME_CHARS_MSG = 'Use letters, spaces, hyphens, apostrophes and periods only.'
const EMAIL_DOMAIN_MSG = `Please use your MSU-Main student email (${EMAIL_DOMAIN}).`

/** Trim, then collapse every run of whitespace to one space. Mirrors the backend. */
const normalizeName = (value?: string) => (value ?? '').trim().replace(/\s+/gu, ' ')

/**
 * Name case: the first letter of each word — and after a hyphen, apostrophe or period
 * ("Mary-Ann", "O'Brien", "Ma. Clara") — uppercase, the rest lowercase. Only letter
 * case changes, never spacing. Mirrors RegisterRequest::nameCase.
 */
const toNameCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s\-'.])(\p{Ll})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())

/**
 * Full Name (as per records): first name, middle initial(s), last name — "Juan A. Dela Cruz";
 * a two-word middle name gives "D. C.". Never typed by the applicant. Mirrors RegisterRequest::fullName.
 */
const fullNameFrom = (first?: string, middle?: string, last?: string) => {
  const initials = normalizeName(middle).split(' ').filter(Boolean).map((word) => `${word[0]}.`).join(' ')
  return toNameCase([normalizeName(first), initials, normalizeName(last)].filter(Boolean).join(' '))
}

/** Validates the normalized value, so stray spaces are never the reason a name is rejected. */
const nameField = (max: number, requiredMsg: string) =>
  z
    .string()
    .refine((val) => normalizeName(val).length > 0, requiredMsg)
    .refine((val) => normalizeName(val).length <= max, `Must be ${max} characters or fewer`)
    .refine((val) => normalizeName(val) === '' || NAME_RE.test(normalizeName(val)), NAME_CHARS_MSG)

const schema = z
  .object({
    // Built from the name fields (read-only on the form).
    name: z.string(),
    email: z
      .string()
      .email('Enter a valid email')
      .refine((e) => e.trim().toLowerCase().endsWith(EMAIL_DOMAIN), { message: EMAIL_DOMAIN_MSG }),
    password: strongPassword,
    password_confirmation: z.string(),
    student_id_number: z.string().regex(/^\d{9}$/, 'Student ID must be exactly 9 digits'),
    first_name: nameField(100, 'Required'),
    middle_name: z
      .string()
      .optional()
      .refine((val) => normalizeName(val).length <= 100, 'Must be 100 characters or fewer')
      .refine((val) => normalizeName(val) === '' || NAME_RE.test(normalizeName(val)), NAME_CHARS_MSG),
    last_name: nameField(100, 'Required'),
    contact_number: z.string().optional(),
    college: z.string().min(1, 'College is required'),
    program: z.string().min(1, 'Program is required'),
    year_level: z.coerce.number().min(1).max(5),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })
  // 5th year only exists for the five-year programs; keep 4-year applicants from picking it.
  .refine((d) => d.year_level <= maxYearFor(d.program), {
    message: 'A 5th year applies only to College of Engineering programs and BS Accountancy.',
    path: ['year_level'],
  })

type FormData = z.infer<typeof schema>

const STEP1_FIELDS = ['first_name', 'middle_name', 'last_name', 'name', 'student_id_number', 'email'] as const
const STEP2_FIELDS = ['college', 'program', 'year_level', 'password', 'password_confirmation'] as const

/**
 * Colleges and programs from the official student masterlist (AY 2025–2026, 1st semester): main campus
 * only, bachelor's programs plus diplomas/certificates (graduate programs left out). Names as in the
 * masterlist. Value (code) is what gets stored; existing codes are kept so saved profiles still match.
 */
const COLLEGES: { value: string; label: string; programs: string[] }[] = [
  { value: 'CA', label: 'College of Agriculture', programs: ['BS Agribusiness Management', 'BS Agricultural Business Management', 'BS Agriculture (Major in Animal Science)', 'BS Agriculture major in Agricultural Food Processing', 'BS Agriculture major in Agronomy', 'BS Agriculture major in Extension Education', 'BSA Agricultural Extension', 'BSA Farming Systems', 'BSA Horticulture', 'BSA Soil Science', 'BSA major in Food Processing', 'DABMT-Food Processing', 'DAT Crop Production Technology'] },
  { value: 'CBAA', label: 'College of Business Administration and Accountancy', programs: ['BS Accountancy', 'BS Entrepreneurship', 'BSBA Business Economics', 'BSBA Human Resource Management', 'BSBA Marketing Management (Advertising)', 'BSBA Marketing Management (Digital Marketing)'] },
  { value: 'CED', label: 'College of Education', programs: ['BSEd English', 'BSEd Filipino', 'BSEd Mathematics', 'BSEd Sciences', 'BSEd Social Studies', 'BTLEd Home Economics', 'BTVTEd Home Economics', 'Bachelor of Early Childhood Education (BECEd)', 'Bachelor of Elementary Education (BEEd)'] },
  { value: 'CoE', label: 'College of Engineering', programs: ['BS Agricultural and Biosystems Engineering', 'BS Chemical Engineering', 'BS Civil Engineering', 'BS Civil Engineering (Structural)', 'BS Electrical Engineering', 'BS Electronics Engineering', 'BS Mechanical Engineering'] },
  { value: 'CF', label: 'College of Fisheries and Aquatic Sciences', programs: ['BS Fisheries', 'Diploma in Fisheries Technology (Ladderized Program) Major in Aquaculture', 'Diploma in Fisheries Technology (Ladderized Program) Major in Fish Processing'] },
  { value: 'CFES', label: 'College of Forestry and Environmental Studies', programs: ['BS Environmental Science', 'BS Forestry', 'BS Forestry major in Agroforestry'] },
  { value: 'CHS', label: 'College of Health Sciences', programs: ['BS Midwifery', 'BS Nursing', 'BS Pharmacy'] },
  { value: 'CHTM', label: 'College of Hospitality and Tourism Management', programs: ['BS Hospitality Management', 'BS Tourism Management'] },
  { value: 'CICS', label: 'College of Information and Computing Sciences', programs: ['BS Computer Science', 'BS Information Systems', 'BS Information Technology (Database Systems)', 'BS Information Technology (Network Systems)'] },
  { value: 'CNSM', label: 'College of Natural Sciences and Mathematics', programs: ['BS Biology (Animal Biology)', 'BS Chemistry', 'BS Mathematics', 'BS Physics', 'BS Statistics', 'Certificate in Statistics'] },
  { value: 'CPA', label: 'College of Public Affairs', programs: ['BS Social Work', 'BS Sustainable Community Development', 'Bachelor of Public Administration'] },
  { value: 'CSSH', label: 'College of Social Sciences and Humanities', programs: ['AB Communication Studies major in Devt. Com.', 'AB Communication Studies major in Journalism', 'BA Communication Studies (Media Education)', 'BA English Language Studies', 'BA Filipino', 'BA History International History Track', 'BA History Philippine and Asian History Track', 'BA History Public History/Development Track', 'BA Journalism', 'BA Literary and Cultural Studies', 'BA Panitikan', 'BA Philosophy', 'BA Political Science', 'BA Psychology', 'BA Sociology', 'BS Development Communication', 'BS Psychology', 'Bachelor of Library and Information Science'] },
  { value: 'CSPEAR', label: 'College of Sports, Physical Education and Recreation', programs: ['BS Physical Education'] },
  { value: 'DET', label: 'Division of Engineering Technology', programs: ['BSET Construction Engineering Management', 'BSET Electrical and Renewable Energy', 'BSET Machining and Fabrication', 'DT Machine Shop Technology', 'Diploma in Electrical Technology major in Renewable Energy', 'Diploma in Technology Major in Construction Technology'] },
  { value: 'KFCIAAS', label: 'King Faisal Center for Islamic, Arabic and Asian Studies', programs: ['AB Islamic Studies major in Shariah', 'BS International Relations', 'BS Islamic Banking and Finance', 'BS Teaching Arabic'] },
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

const FIELD = 'flex h-12 items-center gap-2.5 rounded-[11px] border border-ink-200 bg-white px-3.5 transition-colors focus-within:border-brand-700'
const INPUT = 'min-w-0 flex-1 border-none bg-transparent text-sm text-ink-900 placeholder-ink-350 focus:outline-none'
const LABEL = 'mb-[7px] block text-[12.5px] font-semibold text-ink-600'
const ICON = 'h-[19px] w-[19px] flex-none text-ink-400'

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']

/**
 * Five-year programs: the College of Engineering's and BS Accountancy (same list as
 * RegisterRequest::FIVE_YEAR_PROGRAMS). Every other program caps at four.
 */
const FIVE_YEAR_PROGRAMS = [
  'BS Agricultural and Biosystems Engineering',
  'BS Chemical Engineering',
  'BS Civil Engineering',
  'BS Civil Engineering (Structural)',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Mechanical Engineering',
  'BS Accountancy',
].map((p) => p.toLowerCase())
const maxYearFor = (program?: string) =>
  program && FIVE_YEAR_PROGRAMS.includes(program.trim().toLowerCase()) ? 5 : 4

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
          on ? 'bg-gold-300 text-brand-900' : 'border-[1.5px] border-gold-300/40 bg-gold-300/10 text-gold-300'
        } ${active ? 'ring-4 ring-gold-300/20' : ''}`}
      >
        {done ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : n}
      </span>
      <div>
        <div className={`text-[15px] font-bold ${on ? 'text-ink-25' : 'text-ink-25/70'}`}>{meta.title}</div>
        <div className="mt-0.5 text-xs text-ink-25/55">{meta.sub}</div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [showPw, setShowPw] = useState(false)
  const [certified, setCertified] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)
  const [resendSent, setResendSent] = useState(false)

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onTouched' })

  // Names take name case as they're typed; only letter case changes, so the caret stays put.
  const nameInput = (field: 'first_name' | 'middle_name' | 'last_name') =>
    register(field, {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const el = e.target
        const formatted = toNameCase(el.value)
        if (formatted === el.value) return
        const { selectionStart, selectionEnd } = el
        setValue(field, formatted, { shouldDirty: true })
        el.setSelectionRange(selectionStart, selectionEnd)
      },
    })

  // Full Name is always First + middle initial(s) + Last ("Andres" -> "A.", "Dela Cruz" -> "D. C.").
  const [firstName, middleName, lastName] = watch(['first_name', 'middle_name', 'last_name'])
  useEffect(() => {
    setValue('name', fullNameFrom(firstName, middleName, lastName), { shouldValidate: !!getFieldState('name').error })
  }, [firstName, middleName, lastName, setValue, getFieldState])

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

  const resend = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => setResendSent(true),
  })

  const signup = useMutation({
    mutationFn: (data: FormData) =>
      authApi.register({
        ...data,
        first_name: toNameCase(normalizeName(data.first_name)),
        middle_name: toNameCase(normalizeName(data.middle_name)) || undefined,
        last_name: toNameCase(normalizeName(data.last_name)),
        name: fullNameFrom(data.first_name, data.middle_name, data.last_name),
        email: data.email.trim().toLowerCase(),
      }),
    onSuccess: () => {
      // No auto-login — the applicant must verify their email first.
      setVerifyEmail(watch('email'))
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
      setFieldErrors({})
      setStep((s) => Math.min(3, s + 1))
    }
  }

  const [heading, subhead] = HEADINGS[step]

  // Application period closed → show a notice instead of the signup form.
  // After a successful signup, ask the applicant to verify their email.
  if (verifyEmail) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-ink-100 p-4 sm:p-8">
        <div className="w-full max-w-md rounded-[18px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(19,36,26,0.20)]">
          <Image src="/dsa-logo.png" alt="DSA Logo" width={64} height={64} className="mx-auto" priority />
          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
            <MailCheck className="h-6 w-6 text-success-600" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-medium text-ink-950">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            We sent a verification link to <span className="font-semibold text-ink-950">{verifyEmail}</span>.
            Click it within <span className="font-semibold text-ink-950">5 minutes</span> to activate your account, then sign in.
            (Check your spam folder, and use Resend below if it expires.)
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => resend.mutate(verifyEmail)}
              disabled={resend.isPending || resendSent}
              className="rounded-xl border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-60 transition-colors"
            >
              {resendSent ? 'Verification email resent ✓' : resend.isPending ? 'Resending…' : 'Resend verification email'}
            </button>
            <Link href="/login" className="rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-6 py-3 text-sm font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!statusLoading && appStatus && !appStatus.open) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-ink-100 p-4 sm:p-8">
        <div className="w-full max-w-md rounded-[18px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(19,36,26,0.20)]">
          <Image src="/dsa-logo.png" alt="DSA Logo" width={64} height={64} className="mx-auto" priority />
          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Lock className="h-6 w-6 text-brand-700" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-medium text-ink-950">Registration is closed</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {appStatus.message ?? 'The application period has not started yet. Please check back later.'}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/login" className="rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-6 py-3 text-sm font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110">
              Sign in to an existing account
            </Link>
            <Link href="/" className="rounded-xl border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-ink-50 transition-colors">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ink-100 p-4 sm:p-8">
      <div className="flex w-full max-w-[1080px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_60px_rgba(19,36,26,0.20)] lg:h-[720px]">
        {/* Sidebar — vertical stepper */}
        <div className="hidden w-[316px] flex-none flex-col bg-gradient-to-b from-brand-700 to-brand-950 p-9 text-ink-25 lg:flex">
          <div className="mb-14 flex items-center gap-3">
            <Image src="/dsa-logo.png" alt="DSA Logo" width={40} height={40} priority />
            <div className="leading-tight">
              <p className="font-serif text-base font-semibold text-ink-25">SWAP Portal</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-300">MSU — Marawi</p>
            </div>
          </div>

          <div className="relative flex-1">
            {/* connecting line */}
            <div className="absolute left-[18px] top-4 bottom-10 w-0.5 bg-gold-300/20" />
            <div className="space-y-9">
              {STEP_META.map((_, i) => (
                <StepDot key={i} index={i} step={step} />
              ))}
            </div>
          </div>

          <div className="text-xs text-ink-25/60">
            Need help?
            <br />
            <span className="text-gold-300">dsa@msumain.edu.ph</span>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-ink-50 p-7 sm:p-12">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-gold-600">Step {step} of 3</div>
          <h2 className="mt-2 font-serif text-[29px] font-medium leading-tight text-ink-950">{heading}</h2>
          <p className="mt-1.5 text-sm text-ink-500">{subhead}</p>

          {serverError && (
            <div className="mt-5 rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{serverError}</div>
          )}

          <form
            onSubmit={handleSubmit((d) => {
              if (step === 3 && !signup.isPending) signup.mutate(d)
            })}
            className="mt-6 flex flex-1 flex-col"
          >
            <div className="flex-1">
              {/* STEP 1 — Personal */}
              {step === 1 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
                    <div>
                      <label className={LABEL}>First Name</label>
                      <div className={FIELD}><User className={ICON} /><input {...nameInput('first_name')} maxLength={100} placeholder="Juan" className={INPUT} /></div>
                      {(errors.first_name || fieldErrors.first_name) && <p className="mt-1 text-xs text-danger-700">{errors.first_name?.message ?? fieldErrors.first_name}</p>}
                    </div>
                    <div>
                      <label className={LABEL}>Middle Name <span className="font-normal text-ink-400">(optional)</span></label>
                      <div className={FIELD}><User className={ICON} /><input {...nameInput('middle_name')} maxLength={100} placeholder="Andres" className={INPUT} /></div>
                      {(errors.middle_name || fieldErrors.middle_name) && <p className="mt-1 text-xs text-danger-700">{errors.middle_name?.message ?? fieldErrors.middle_name}</p>}
                    </div>
                    <div>
                      <label className={LABEL}>Last Name</label>
                      <div className={FIELD}><User className={ICON} /><input {...nameInput('last_name')} maxLength={100} placeholder="Dela Cruz" className={INPUT} /></div>
                      {(errors.last_name || fieldErrors.last_name) && <p className="mt-1 text-xs text-danger-700">{errors.last_name?.message ?? fieldErrors.last_name}</p>}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Full Name (as per records)</label>
                    <div className={`${FIELD} !bg-ink-50`}><Contact className={ICON} /><input {...register('name')} readOnly tabIndex={-1} aria-readonly="true" placeholder="Juan A. Dela Cruz" className={`${INPUT} cursor-default`} /></div>
                    {fieldErrors.name
                      ? <p className="mt-1 text-xs text-danger-700">{fieldErrors.name}</p>
                      : <p className="mt-1 text-[11px] text-ink-500">Filled in automatically from your names, with your middle initial.</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Student ID Number</label>
                    <div className={FIELD}><Hash className={ICON} /><input {...register('student_id_number')} inputMode="numeric" maxLength={9} placeholder="9-digit student ID" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 9) }} className={INPUT} /></div>
                    {(errors.student_id_number || fieldErrors.student_id_number) && <p className="mt-1 text-xs text-danger-700">{errors.student_id_number?.message ?? fieldErrors.student_id_number}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Email Address</label>
                    <div className={FIELD}><Mail className={ICON} /><input {...register('email')} type="email" placeholder="student@s.msumain.edu.ph" className={INPUT} /></div>
                    {(errors.email || fieldErrors.email) && <p className="mt-1 text-xs text-danger-700">{errors.email?.message ?? fieldErrors.email}</p>}
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
                      <ChevronDown className="h-4 w-4 flex-none text-ink-400" />
                    </div>
                    {(errors.college || fieldErrors.college) && <p className="mt-1 text-xs text-danger-700">{errors.college?.message ?? fieldErrors.college}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Course / Program</label>
                    <div className={FIELD}>
                      <BookOpen className={ICON} />
                      <select {...register('program', { onChange: () => setValue('year_level', '' as unknown as number) })} defaultValue="" disabled={!selectedCollege} className={`${INPUT} appearance-none disabled:text-ink-350`}>
                        <option value="" disabled>{selectedCollege ? 'Select program' : 'Select college first'}</option>
                        {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="h-4 w-4 flex-none text-ink-400" />
                    </div>
                    {(errors.program || fieldErrors.program) && <p className="mt-1 text-xs text-danger-700">{errors.program?.message ?? fieldErrors.program}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Year Level</label>
                    <div className={FIELD}>
                      <GraduationCap className={ICON} />
                      <select {...register('year_level')} defaultValue="" className={`${INPUT} appearance-none`}>
                        <option value="" disabled>Select year</option>
                        {Array.from({ length: maxYearFor(v.program) }, (_, i) => i + 1).map((y) => (
                          <option key={y} value={y}>{ORDINAL[y]} Year</option>
                        ))}
                      </select>
                      <ChevronDown className="h-4 w-4 flex-none text-ink-400" />
                    </div>
                    {maxYearFor(v.program) === 5 && (
                      <p className="mt-1 text-[11px] text-ink-500">This program runs five years.</p>
                    )}
                    {(errors.year_level || fieldErrors.year_level) && <p className="mt-1 text-xs text-danger-700">{errors.year_level?.message ?? fieldErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Set Password</label>
                    <PasswordGuide value={v.password}>
                      <div className={FIELD}>
                        <Lock className={ICON} />
                        <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="new-password" className={INPUT} />
                        <button type="button" onClick={() => setShowPw((s) => !s)} className="text-ink-400 hover:text-brand-700 transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                          {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                      </div>
                    </PasswordGuide>
                    {(errors.password || fieldErrors.password) && <p className="mt-1 text-xs text-danger-700">{errors.password?.message ?? fieldErrors.password}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Confirm Password</label>
                    <div className={FIELD}>
                      <Lock className={ICON} />
                      <input {...register('password_confirmation')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="new-password" className={INPUT} />
                    </div>
                    {errors.password_confirmation && <p className="mt-1 text-xs text-danger-700">{errors.password_confirmation.message}</p>}
                  </div>
                </div>
              )}

              {/* STEP 3 — Review */}
              {step === 3 && (
                <div>
                  <div className="overflow-hidden rounded-[14px] border border-ink-200 bg-white">
                    {[
                      ['Full Name', v.name],
                      ['Student ID', v.student_id_number],
                      ['Email', v.email],
                      ['College', collegeLabel],
                      ['Program · Year', `${v.program || '—'} · ${v.year_level ? `${ORDINAL[Number(v.year_level)]} Year` : '—'}`],
                    ].map(([label, value], i, arr) => (
                      <div key={label} className={`flex items-center justify-between gap-4 px-5 py-[15px] ${i < arr.length - 1 ? 'border-b border-ink-100' : ''}`}>
                        <span className="flex-none text-[13px] text-ink-500">{label}</span>
                        <span className="truncate text-right text-sm font-semibold text-ink-900">{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <label className="mt-[18px] flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-600">
                    <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-none rounded accent-brand-700" />
                    I certify that the information provided is accurate and complete.
                  </label>
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-200 pt-5">
              {step === 1 ? (
                <span className="text-[13.5px] text-ink-500">
                  Already have an account?{' '}
                  <Link href="/login" className="font-bold text-brand-700 hover:text-brand-600 transition-colors">Sign in</Link>
                </span>
              ) : (
                <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex h-12 items-center gap-2 rounded-[11px] border border-ink-200 bg-white px-5 text-[14.5px] font-semibold text-brand-700 hover:bg-ink-50 transition-colors">
                  <ArrowLeft className="h-[18px] w-[18px]" /> Back
                </button>
              )}

              {step < 3 ? (
                <button type="button" onClick={next} disabled={signup.isPending} className="flex h-12 items-center gap-2 rounded-[11px] bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-[14.5px] font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-50">
                  Continue <ArrowRight className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <button type="submit" disabled={signup.isPending || !certified} className="flex h-12 items-center gap-2 rounded-[11px] bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-[14.5px] font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-50">
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
