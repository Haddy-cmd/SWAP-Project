'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Lock } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth.api'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { ThemeSetting } from '@/components/layout/ThemeToggle'
import { ProfileAside } from '@/components/profile/ProfileAside'
import { SignatureCard } from '@/components/profile/SignatureCard'
import { SecurityTab } from '@/components/profile/SecurityTab'
import { ActivityTab } from '@/components/profile/ActivityTab'
import { BTN_GHOST, BTN_PRIMARY, CARD, INPUT, LABEL, PHONE_MESSAGE, PHONE_OK, normalizePhone } from '@/components/profile/ui'
import type { User } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(255),
  // Checked again by the API, with the same words.
  contact_number: z.string().refine((v) => v.trim() === '' || PHONE_OK(v), PHONE_MESSAGE),
  position_title: z.string().max(150, 'Max 150 characters'),
  // Staff only; checked again by the API (digits, unique).
  employee_id: z.string().regex(/^(\d{4,15})?$/, 'Enter your employee ID (digits only).'),
})
type ProfileForm = z.infer<typeof profileSchema>

type Tab = 'profile' | 'security' | 'activity'
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'activity', label: 'Activity' },
]

const valuesOf = (u: User | null): ProfileForm => ({
  name: u?.name ?? '',
  contact_number: u?.profile?.contact_number ?? '',
  position_title: u?.position_title ?? '',
  employee_id: u?.employee_id ?? '',
})

const goTo = (id: string) => {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  ;(el?.querySelector('input,button') as HTMLElement | null)?.focus({ preventScroll: true })
}

function ProfileTab({ user }: { user: User }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const queryClient = useQueryClient()
  const { notify } = useFeedback()
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const role = user.role
  const isStudent = !!user.profile
  const canSign = role === 'admin' || role === 'supervisor' || role === 'recipient'

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesOf(user),
  })
  // A different account (or the first load) refills the form; edits in progress are kept otherwise.
  useEffect(() => { reset(valuesOf(user)) }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const updateProfile = useMutation({
    mutationFn: (d: ProfileForm) =>
      authApi.updateProfile({
        name: d.name.trim(),
        ...(isStudent ? { contact_number: normalizePhone(d.contact_number) || null } : {}),
        // Supervisor titles are fixed policy ("SWAP Mentor"); only the admin's is manual.
        ...(role === 'admin' ? { position_title: d.position_title || null } : {}),
        ...(!isStudent && d.employee_id ? { employee_id: d.employee_id } : {}),
      }),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      reset(valuesOf(updated))
      for (const key of ['supervisor-students', 'admin-users', 'student-summary', 'profile-activity']) queryClient.invalidateQueries({ queryKey: [key] })
      notify({ title: 'Profile updated' })
    },
    onError: (err: ApiError) => setProfileMsg(err.message ?? 'Update failed.'),
  })
  const save = handleSubmit((d) => { setProfileMsg(null); updateProfile.mutate(d) })

  // "Finish your profile": what this role still needs (as saved, not as typed).
  const steps: { label: string; done: boolean; target: string }[] = [
    { label: 'Name', done: user.name.trim().length >= 2, target: 'field-name' },
    ...(isStudent ? [{ label: 'Phone', done: !!user.profile?.contact_number, target: 'field-phone' }] : []),
    ...(!isStudent ? [{ label: 'Employee ID', done: !!user.employee_id, target: 'field-employee' }] : []),
    ...(role === 'admin' ? [{ label: 'Position title', done: !!user.position_title, target: 'field-position' }] : []),
    ...(canSign ? [{ label: 'Signature', done: !!user.signature_url && !user.signature_missing, target: 'field-signature' }] : []),
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className="space-y-5">
      {doneCount < steps.length && (
        <section className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14.5px] font-bold text-ink-950">Finish your profile</h2>
            <span className="text-[12.5px] font-semibold text-ink-500">{doneCount} of {steps.length} done</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.map((s) => (
              <button key={s.label} type="button" onClick={() => !s.done && goTo(s.target)} disabled={s.done}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  s.done ? 'border-transparent bg-accent-soft text-accent-strong' : 'border-ink-200 text-ink-700 hover:border-accent hover:text-accent'}`}>
                {s.done ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-current opacity-60" />}
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Contact details */}
      <section className={`${CARD} p-6`}>
        <h2 className="text-[16px] font-bold text-ink-950">Contact details</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-500">How the DSA office and your {isStudent ? 'supervisor' : 'team'} reach you.</p>

        {profileMsg && <div className="mt-4 rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{profileMsg}</div>}

        <form id="profile-form" onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div id="field-name" className="sm:col-span-2">
            <label className={LABEL} htmlFor="p-name">Full name</label>
            <input id="p-name" {...register('name')} autoComplete="name" className={INPUT} />
            {errors.name && <p className="mt-1 text-xs text-danger-700">{errors.name.message}</p>}
          </div>
          {isStudent && (
            <div id="field-phone">
              <label className={LABEL} htmlFor="p-phone">Phone</label>
              <input id="p-phone" {...register('contact_number')} inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" className={INPUT} />
              {errors.contact_number
                ? <p className="mt-1 text-xs text-danger-700">{errors.contact_number.message}</p>
                : <p className="mt-1 text-[11.5px] text-ink-400">Your mobile number, 11 digits.</p>}
            </div>
          )}
          <div className={isStudent ? '' : 'sm:col-span-2'}>
            <label className={LABEL} htmlFor="p-email">Email</label>
            <div className="relative">
              <input id="p-email" value={user.email} disabled className={`${INPUT} pr-10`} />
              <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-350" />
            </div>
            <p className="mt-1 text-[11.5px] text-ink-400">Managed by the DSA office.</p>
          </div>
          {!isStudent && (
            <div id="field-employee" className={role === 'admin' ? '' : 'sm:col-span-2'}>
              <label className={LABEL} htmlFor="p-emp">Employee ID</label>
              <input id="p-emp" {...register('employee_id')} inputMode="numeric" placeholder="Digits only, e.g. 20190123" className={INPUT} />
              {errors.employee_id
                ? <p className="mt-1 text-xs text-danger-700">{errors.employee_id.message}</p>
                : <p className="mt-1 text-[11.5px] text-ink-400">How the DSA identifies you in the portal.</p>}
            </div>
          )}
          {role === 'admin' && (
            <div id="field-position">
              <label className={LABEL} htmlFor="p-pos">Position title</label>
              <input id="p-pos" {...register('position_title')} placeholder="e.g. Director, Division of Student Affairs" className={INPUT} />
              {errors.position_title
                ? <p className="mt-1 text-xs text-danger-700">{errors.position_title.message}</p>
                : <p className="mt-1 text-[11.5px] text-ink-400">Printed under your name on stubs you sign. Releases wait until it&apos;s set.</p>}
            </div>
          )}
        </form>
      </section>

      {canSign && <SignatureCard user={user} />}

      <section className={`${CARD} flex flex-wrap items-center justify-between gap-4 p-6`}>
        <div>
          <h2 className="text-[16px] font-bold text-ink-950">Appearance</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Light, dark, or follow your device. Saved on this browser.</p>
        </div>
        <ThemeSetting />
      </section>

      {isDirty && (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-ink-900/[.08] bg-surface px-4 py-3 shadow-[0_10px_30px_rgba(20,40,30,.18)]">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
            <span className="h-2 w-2 rounded-full bg-gold-accent" /> You have unsaved changes
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setProfileMsg(null); reset(valuesOf(user)) }} disabled={updateProfile.isPending} className={BTN_GHOST}>
              Discard
            </button>
            <button type="submit" form="profile-form" disabled={updateProfile.isPending} className={BTN_PRIMARY}>
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfilePageInner() {
  const user = useAuthStore((s) => s.user)
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const asked = params.get('tab')
  const tab: Tab = asked === 'security' || asked === 'activity' ? asked : 'profile'
  const setTab = (t: Tab) => router.replace(t === 'profile' ? pathname : `${pathname}?tab=${t}`, { scroll: false })

  if (!user) return null

  return (
    <div className="text-ink-950">
      <div className="mb-5 flex items-center gap-1.5 text-[13px] text-ink-400">
        <Link href={getRoleDashboard(user.role)} className="transition-colors hover:text-accent">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-semibold text-accent">My profile</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-4"><ProfileAside user={user} /></div>

        <div className="min-w-0">
          <div role="tablist" className="no-scrollbar mb-5 flex gap-6 overflow-x-auto border-b border-ink-900/[.08]">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 pb-3 pt-1 text-[14px] transition-colors ${
                  tab === t.id ? 'border-accent font-semibold text-ink-950' : 'border-transparent font-medium text-ink-500 hover:text-ink-800'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Kept mounted so unsaved edits survive a look at another tab. */}
          <div hidden={tab !== 'profile'}><ProfileTab user={user} /></div>
          {tab === 'security' && <SecurityTab />}
          {tab === 'activity' && <ActivityTab />}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-ink-100" />}>
      <ProfilePageInner />
    </Suspense>
  )
}
