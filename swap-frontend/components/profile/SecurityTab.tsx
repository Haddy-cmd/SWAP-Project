'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, Laptop, Loader2, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react'
import { strongPassword } from '@/lib/utils/password'
import { PasswordGuide } from '@/components/auth/PasswordGuide'
import { authApi } from '@/lib/api/auth.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { ProfileSession } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'
import { BTN_GHOST, BTN_PRIMARY, CARD, INPUT, LABEL, longDate, timeAgo } from './ui'

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password required'),
    password: strongPassword,
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, { message: 'Passwords do not match', path: ['password_confirmation'] })
type PasswordForm = z.infer<typeof passwordSchema>

const DEVICE_ICON: Record<ProfileSession['kind'], typeof Monitor> = {
  phone: Smartphone, tablet: Tablet, desktop: Laptop, unknown: Monitor,
}

/** Used within the last 5 minutes (or this very browser). */
const activeNow = (s: ProfileSession) =>
  s.current || (!!s.last_used_at && Date.now() - new Date(s.last_used_at).getTime() < 5 * 60_000)

export function SecurityTab() {
  const queryClient = useQueryClient()
  const { notify, notifyError, confirm } = useFeedback()
  const [showPw, setShowPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  const { data: me } = useQuery({ queryKey: ['my-profile'], queryFn: authApi.getProfile })
  const sessions = useQuery({ queryKey: ['profile-sessions'], queryFn: authApi.sessions })
  const list = sessions.data ?? []
  const others = list.filter((s) => !s.current).length

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const updatePassword = useMutation({
    mutationFn: (d: PasswordForm) => authApi.updatePassword(d),
    onSuccess: () => {
      // The API also ends every other login.
      notify({ title: 'Password changed', detail: 'Other devices were signed out. Use your new password next time.' })
      reset()
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['profile-activity'] })
    },
    onError: (err: ApiError) => setPwMsg(err.message ?? 'Change failed.'),
  })

  const afterRevoke = () => {
    queryClient.invalidateQueries({ queryKey: ['profile-sessions'] })
    queryClient.invalidateQueries({ queryKey: ['profile-activity'] })
  }
  const revokeOne = useMutation({
    mutationFn: (id: number) => authApi.revokeSession(id),
    onSuccess: (r) => { notify({ title: r.message }); afterRevoke() },
    onError: (err: ApiError) => notifyError(err, 'Could not sign out that device'),
  })
  const revokeOthers = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: (r) => { notify({ title: r.message ?? 'Signed out of other devices' }); afterRevoke() },
    onError: (err: ApiError) => notifyError(err, 'Could not sign out the other devices'),
  })

  return (
    <div className="space-y-5">
      {/* Change password */}
      <section className={`${CARD} p-4 sm:p-6`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-ink-950">Change password</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              {me?.password_changed_at ? `Last changed ${longDate(me.password_changed_at)}` : 'Not changed here yet'}
            </p>
          </div>
        </div>

        {pwMsg && <div className="mb-4 rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{pwMsg}</div>}

        <form onSubmit={handleSubmit((d) => { setPwMsg(null); updatePassword.mutate(d) })} className="space-y-4">
          <div className="sm:max-w-[calc(50%-8px)]">
            <label className={LABEL} htmlFor="pw-current">Current password</label>
            <div className="relative">
              <input id="pw-current" {...register('current_password')} type={showPw ? 'text' : 'password'} autoComplete="current-password" className={`${INPUT} pr-11`} />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-accent">
                {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
            {errors.current_password && <p className="mt-1 text-xs text-danger-700">{errors.current_password.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="pw-new">New password</label>
              <PasswordGuide value={watch('password')}>
                <input id="pw-new" {...register('password')} type={showPw ? 'text' : 'password'} autoComplete="new-password" className={INPUT} />
              </PasswordGuide>
              {errors.password && <p className="mt-1 text-xs text-danger-700">{errors.password.message}</p>}
            </div>
            <div>
              <label className={LABEL} htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" {...register('password_confirmation')} type={showPw ? 'text' : 'password'} autoComplete="new-password" className={INPUT} />
              {errors.password_confirmation && <p className="mt-1 text-xs text-danger-700">{errors.password_confirmation.message}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={updatePassword.isPending} className={BTN_PRIMARY}>
              <KeyRound className="h-4 w-4" /> {updatePassword.isPending ? 'Updating…' : 'Update password'}
            </button>
            <span className="text-[12px] text-ink-400">Changing it signs you out everywhere else.</span>
          </div>
        </form>
      </section>

      {/* Devices */}
      <section className={`${CARD} p-4 sm:p-6`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-ink-950">Where you&apos;re signed in</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-500">Don&apos;t recognise a device? Sign it out and change your password.</p>
          </div>
          {others > 0 && (
            <button type="button" disabled={revokeOthers.isPending} className={BTN_GHOST}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Sign out other devices?',
                  body: `This ends your session on ${others} other ${others === 1 ? 'device' : 'devices'}. You stay signed in here.`,
                  confirmLabel: 'Sign them out',
                  tone: 'danger',
                })
                if (ok) revokeOthers.mutate()
              }}>
              {revokeOthers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out other devices
            </button>
          )}
        </div>

        {sessions.isLoading ? (
          <div className="space-y-2 py-2">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-ink-100" />)}</div>
        ) : sessions.isError ? (
          <p className="py-4 text-sm text-danger-700">Couldn&apos;t load your devices. Refresh to try again.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[.06]">
            {list.map((s) => {
              const Icon = DEVICE_ICON[s.kind] ?? Monitor
              return (
                <li key={s.id} className="flex items-center gap-3.5 py-3.5">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-ink-100 text-ink-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                      {s.device}
                      {s.current && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold text-accent-strong">This device</span>}
                    </div>
                    <div className="text-[12px] text-ink-500">
                      {[s.ip_address, activeNow(s) ? 'Active now' : `Last active ${timeAgo(s.last_used_at ?? s.created_at)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {!s.current && (
                    <button type="button" onClick={() => revokeOne.mutate(s.id)}
                      disabled={revokeOne.isPending && revokeOne.variables === s.id}
                      className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-60">
                      {revokeOne.isPending && revokeOne.variables === s.id ? 'Signing out…' : 'Sign out'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
