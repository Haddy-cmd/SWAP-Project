'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ChevronRight, ShieldCheck, Mail, Phone, Building2, CalendarDays, LogOut,
  Save, KeyRound, Lock, Bell, CheckCircle2, FileCheck, Clock, Camera, Loader2,
  Eye, EyeOff, PenLine,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { authApi } from '@/lib/api/auth.api'
import { notificationsApi } from '@/lib/api/notifications.api'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import { avatarSrc } from '@/lib/utils/avatar'
import { AvatarCropper } from '@/components/shared/AvatarCropper'
import { SignaturePad } from '@/components/shared/SignaturePad'
import type { UserRole } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  recipient: 'Recipient',
  applicant: 'Applicant',
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  contact_number: z.string().max(20).optional().or(z.literal('')),
  position_title: z.string().max(150, 'Max 150 characters').optional().or(z.literal('')),
})
type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password required'),
    password: z.string().min(8, 'Minimum 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })
type PasswordForm = z.infer<typeof passwordSchema>

const INPUT =
  'h-12 w-full rounded-[11px] border border-ink-200 bg-ink-50 px-3.5 text-sm text-ink-900 placeholder-ink-350 focus:border-brand-700 focus:outline-none disabled:cursor-not-allowed disabled:text-ink-400'
const LABEL = 'mb-[7px] block text-[12.5px] font-semibold text-ink-600'
const CARD = 'rounded-2xl border border-ink-200 bg-white p-7 shadow-[0_2px_8px_rgba(19,36,26,0.04)]'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function activityIcon(type: string) {
  if (/verif/i.test(type)) return { Icon: CheckCircle2, bg: '#EFF8F4', fg: '#1F8163' }
  if (/interview/i.test(type)) return { Icon: CalendarDays, bg: '#FFFBEB', fg: '#9A7412' }
  if (/applic/i.test(type)) return { Icon: FileCheck, bg: '#EFE9F7', fg: '#6B4E9A' }
  return { Icon: Bell, bg: '#E3EEE5', fg: '#1F5B3A' }
}

export default function ProfilePage() {
  const { user, token, setAuth } = useAuthStore()
  const { logout, isLoggingOut } = useAuth()
  const [tab, setTab] = useState<'profile' | 'security' | 'activity'>('profile')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [photoMsg, setPhotoMsg] = useState<string | null>(null)
  const [sigMsg, setSigMsg] = useState<string | null>(null)
  const [showPad, setShowPad] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => authApi.uploadPhoto(file),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      setPhotoMsg(null)
      setCropFile(null)
    },
    onError: (err: ApiError) => setPhotoMsg(err.message ?? 'Photo upload failed.'),
  })

  // Selecting a file opens the cropper; the cropped result is what gets uploaded.
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setPhotoMsg(null); setCropFile(file) }
    e.target.value = '' // allow re-picking the same file
  }

  const onCropped = (blob: Blob) => {
    uploadPhoto.mutate(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
  }

  const removePhoto = useMutation({
    mutationFn: () => authApi.removePhoto(),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      setPhotoMsg(null)
    },
    onError: (err: ApiError) => setPhotoMsg(err.message ?? 'Could not remove photo.'),
  })

  const uploadSignature = useMutation({
    mutationFn: (file: File) => authApi.uploadSignature(file),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      setSigMsg(null)
      setShowPad(false)
    },
    onError: (err: ApiError) => setSigMsg(err.message ?? 'Signature upload failed.'),
  })

  const removeSignature = useMutation({
    mutationFn: () => authApi.removeSignature(),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      setSigMsg(null)
    },
    onError: (err: ApiError) => setSigMsg(err.message ?? 'Could not remove signature.'),
  })

  const isStudent = !!user?.profile
  const role = (user?.role ?? 'applicant') as UserRole
  // Digital-signature specimen: admins certify with it, supervisors co-sign with
  // it, recipients sign receipts with it (and cannot clock in without it).
  // Applicants never sign, so no card for them.
  const canSign = role === 'admin' || role === 'supervisor' || role === 'recipient'
  const department =
    role === 'admin' ? 'Division of Students Affairs'
    : role === 'supervisor' ? (user?.office_name ?? 'Unassigned office')
    : (user?.profile?.college ?? '—')
  const memberSince = user?.created_at ? new Date(user.created_at).getFullYear() : '—'

  const {
    register: rp,
    handleSubmit: hp,
    formState: { errors: pe },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', contact_number: user?.profile?.contact_number ?? '', position_title: user?.position_title ?? '' },
  })

  const {
    register: rpw,
    handleSubmit: hpw,
    reset: resetPw,
    formState: { errors: pwe },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) =>
      authApi.updateProfile({
        name: data.name,
        ...(isStudent ? { contact_number: data.contact_number } : {}),
        // Supervisor titles are fixed policy ("SWAP Mentor"); only the admin's
        // title is manual, so only it is ever sent.
        ...(role === 'admin' ? { position_title: data.position_title || null } : {}),
      }),
    onSuccess: (updated) => {
      setAuth(updated, useAuthStore.getState().token ?? '')
      setProfileMsg('Profile updated successfully.')
    },
    onError: (err: ApiError) => setProfileMsg(err.message ?? 'Update failed.'),
  })

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) => authApi.updatePassword(data),
    onSuccess: () => { setPwMsg('Password changed successfully.'); resetPw() },
    onError: (err: ApiError) => setPwMsg(err.message ?? 'Change failed.'),
  })

  const { data: notifPage } = useQuery({
    queryKey: ['notifications', 'profile-activity'],
    queryFn: () => notificationsApi.getNotifications(1),
    enabled: tab === 'activity',
  })
  const activity = notifPage?.data ?? []

  if (!user) return null

  const facts: [string, string][] = isStudent
    ? [
        ['Student ID', user.profile?.student_id_number ?? '—'],
        ['Year Level', user.profile ? String(user.profile.year_level) : '—'],
        ['College', user.profile?.college ?? '—'],
      ]
    : [
        ['Role', ROLE_LABEL[role]],
        ['Status', user.is_active ? 'Active' : 'Inactive'],
        ['Member Since', String(memberSince)],
      ]

  const TABS: { id: typeof tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="mx-auto max-w-[1160px] text-ink-950">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-[13px] text-ink-400">
        <Link href={getRoleDashboard(role)} className="hover:text-brand-700 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-semibold text-brand-700">My Profile</span>
      </div>

      <div className="grid gap-[22px] lg:grid-cols-[336px_1fr] lg:items-start">
        {/* Identity rail */}
        <div className={`${CARD} flex flex-col items-center px-7 py-9 text-center`}>
          <div className="relative mb-[18px]">
            <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600 to-brand-900 shadow-[0_12px_30px_rgba(22,69,43,0.3)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc(user.avatar_url, token) ?? '/default-avatar.svg'} alt={user.name} className="h-full w-full object-cover" />
            </div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploadPhoto.isPending}
              title="Change photo"
              aria-label="Change photo"
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow-md transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPhotoChange} />
          </div>
          {user.avatar_url && (
            <button
              onClick={() => removePhoto.mutate()}
              disabled={removePhoto.isPending}
              className="mb-1 text-xs font-semibold text-ink-400 hover:text-danger-700 disabled:opacity-60 transition-colors"
            >
              {removePhoto.isPending ? 'Removing…' : 'Remove photo'}
            </button>
          )}
          {photoMsg && <p className="mb-2 text-xs text-danger-700">{photoMsg}</p>}
          <div className="font-serif text-[23px] font-semibold text-ink-950">{user.name}</div>
          <span className="mt-2 mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-[11px] font-bold text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_LABEL[role]}
          </span>

          <div className="mb-5 flex w-full flex-col gap-3.5 text-left">
            <div className="flex items-center gap-3 text-[13px] text-ink-600">
              <Mail className="h-[18px] w-[18px] flex-none text-ink-400" /> <span className="truncate">{user.email}</span>
            </div>
            {isStudent && user.profile?.contact_number && (
              <div className="flex items-center gap-3 text-[13px] text-ink-600">
                <Phone className="h-[18px] w-[18px] flex-none text-ink-400" /> {user.profile.contact_number}
              </div>
            )}
            <div className="flex items-center gap-3 text-[13px] text-ink-600">
              <Building2 className="h-[18px] w-[18px] flex-none text-ink-400" /> <span className="truncate">{department}</span>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-ink-600">
              <CalendarDays className="h-[18px] w-[18px] flex-none text-ink-400" /> Member since {memberSince}
            </div>
          </div>

          <div className={`flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border text-[13px] font-semibold ${
            user.is_active ? 'border-success-200 bg-success-50 text-success-800' : 'border-danger-200 bg-danger-50 text-danger-700'
          }`}>
            <span className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-success-600' : 'bg-danger-700'}`} />
            {user.is_active ? 'Active Account' : 'Inactive Account'}
          </div>

          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="mt-3.5 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-danger-200 bg-danger-50 text-sm font-semibold text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-60"
          >
            <LogOut className="h-[18px] w-[18px]" /> {isLoggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>

        {/* Content */}
        <div>
          {/* Tabs */}
          <div className="mb-[22px] inline-flex gap-1 rounded-xl bg-ink-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-[9px] px-5 py-2.5 text-[13.5px] transition-colors ${
                  tab === t.id ? 'bg-white font-semibold text-brand-700 shadow-[0_1px_3px_rgba(19,36,26,0.08)]' : 'font-medium text-ink-500 hover:text-ink-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <div className="space-y-[22px]">
              {/* Account facts */}
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[13px] border border-ink-200 bg-ink-200">
                {facts.map(([label, value]) => (
                  <div key={label} className="bg-white px-5 py-[18px]">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">{label}</div>
                    <div className="truncate font-serif text-[22px] font-semibold text-ink-950">{value}</div>
                  </div>
                ))}
              </div>

              {/* Personal info */}
              <div className={CARD}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700"><ShieldCheck className="h-5 w-5" /></span>
                  <div>
                    <div className="text-[16px] font-bold text-ink-950">Personal Information</div>
                    <div className="text-[12.5px] text-ink-500">Update your name{isStudent ? ' and contact number' : ''}</div>
                  </div>
                </div>

                {profileMsg && (
                  <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${profileMsg.includes('success') ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>{profileMsg}</div>
                )}

                <form onSubmit={hp((d) => { setProfileMsg(null); updateProfile.mutate(d) })} className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>Full Name</label>
                    <input {...rp('name')} className={INPUT} />
                    {pe.name && <p className="mt-1 text-xs text-danger-700">{pe.name.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Email Address</label>
                    <input value={user.email} disabled className={INPUT} />
                    <p className="mt-1 text-[11px] text-ink-400">Managed by the DSA office</p>
                  </div>
                  {isStudent && (
                    <div>
                      <label className={LABEL}>Phone Number</label>
                      <input {...rp('contact_number')} placeholder="+63 9XX XXX XXXX" className={INPUT} />
                    </div>
                  )}
                  <div className={isStudent ? '' : 'sm:col-span-2'}>
                    <label className={LABEL}>{isStudent ? 'College' : 'Office / Department'}</label>
                    <input value={department} disabled className={INPUT} />
                  </div>
                  {!isStudent && role === 'admin' && (
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Position Title</label>
                      <input {...rp('position_title')} placeholder="e.g. Director, Division of Student Affairs" className={INPUT} />
                      {pe.position_title && <p className="mt-1 text-xs text-danger-700">{pe.position_title.message}</p>}
                      <p className="mt-1 text-[11px] text-ink-400">Printed under your name on claim stubs you sign. Releases are blocked until this is set.</p>
                    </div>
                  )}
                  {isStudent && user.profile?.program && (
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Program</label>
                      <input value={user.profile.program} disabled className={INPUT} />
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-3 sm:col-span-2">
                    <button type="submit" disabled={updateProfile.isPending}
                      className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-[14.5px] font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-60">
                      <Save className="h-[18px] w-[18px]" /> {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Digital signature specimen (admins + supervisors only) */}
              {canSign && (
                <div className={CARD}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700"><PenLine className="h-5 w-5" /></span>
                    <div>
                      <div className="text-[16px] font-bold text-ink-950">Digital Signature</div>
                      <div className="text-[12.5px] text-ink-500">
                        {role === 'admin'
                          ? 'Drawn on every claim stub you certify as Director'
                          : role === 'supervisor'
                            ? 'Drawn on every stub co-signed as SWAP Mentor'
                            : 'Required before you can clock in — signs your receipts at payout'}
                      </div>
                    </div>
                  </div>

                  {sigMsg && <div className="mb-4 rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{sigMsg}</div>}

                  {user.signature_url ? (
                    <div>
                      <div className="rounded-xl border border-ink-200 bg-white p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarSrc(user.signature_url, token) ?? ''} alt="Your signature specimen"
                          className="h-20 w-auto max-w-full" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => { setSigMsg(null); setShowPad((s) => !s) }}
                          className="rounded-xl border border-ink-200 px-4 py-2.5 text-[13px] font-semibold text-brand-700 hover:bg-ink-50 transition-colors">
                          {showPad ? 'Close pad' : 'Redraw'}
                        </button>
                        <button onClick={() => { setSigMsg(null); removeSignature.mutate() }} disabled={removeSignature.isPending}
                          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-ink-400 hover:text-danger-700 disabled:opacity-60 transition-colors">
                          {removeSignature.isPending ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`mb-3 text-[13px] ${role === 'recipient' ? 'font-semibold text-danger-700' : 'text-ink-500'}`}>
                      {role === 'recipient'
                        ? 'Clock-in is blocked until you save a signature. Draw below or upload an image.'
                        : 'No specimen on file — stubs show your printed name instead. Draw below or upload an image.'}
                    </p>
                  )}

                  {(!user.signature_url || showPad) && (
                    <div className="mt-3">
                      <SignaturePad busy={uploadSignature.isPending}
                        onSave={(file) => { setSigMsg(null); uploadSignature.mutate(file) }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div className="space-y-[22px]">
              <div className={CARD}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600"><Lock className="h-5 w-5" /></span>
                  <div>
                    <div className="text-[16px] font-bold text-ink-950">Change Password</div>
                    <div className="text-[12.5px] text-ink-500">Use 8+ characters with upper &amp; lower case and numbers</div>
                  </div>
                </div>

                {pwMsg && (
                  <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${pwMsg.includes('success') ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>{pwMsg}</div>
                )}

                <form onSubmit={hpw((d) => { setPwMsg(null); updatePassword.mutate(d) })} className="space-y-4">
                  <div>
                    <label className={LABEL}>Current Password</label>
                    <div className="relative">
                      <input {...rpw('current_password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" className={`${INPUT} pr-11`} />
                      <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand-700 transition-colors">
                        {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {pwe.current_password && <p className="mt-1 text-xs text-danger-700">{pwe.current_password.message}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL}>New Password</label>
                      <input {...rpw('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" className={INPUT} />
                      {pwe.password && <p className="mt-1 text-xs text-danger-700">{pwe.password.message}</p>}
                    </div>
                    <div>
                      <label className={LABEL}>Confirm New Password</label>
                      <input {...rpw('password_confirmation')} type={showPw ? 'text' : 'password'} placeholder="••••••••" className={INPUT} />
                      {pwe.password_confirmation && <p className="mt-1 text-xs text-danger-700">{pwe.password_confirmation.message}</p>}
                    </div>
                  </div>
                  <button type="submit" disabled={updatePassword.isPending}
                    className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-[14.5px] font-semibold text-ink-25 shadow-[0_12px_24px_rgba(22,69,43,0.26)] transition hover:brightness-110 disabled:opacity-60">
                    <KeyRound className="h-[18px] w-[18px]" /> {updatePassword.isPending ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab === 'activity' && (
            <div className={CARD}>
              <div className="mb-5 text-[16px] font-bold text-ink-950">Recent Activity</div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Clock className="h-8 w-8 text-ink-350" />
                  <p className="mt-2 text-sm text-ink-400">No recent activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {activity.map((n) => {
                    const { Icon, bg, fg } = activityIcon(n.data?.type ?? n.type)
                    return (
                      <div key={n.id} className="flex gap-3.5 border-b border-ink-100 py-3.5 last:border-0">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color: fg }}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="flex-1 leading-snug">
                          <div className="text-[13.5px] text-ink-700">{n.data?.title ?? n.data?.message ?? 'Notification'}</div>
                          <div className="text-xs text-ink-400">{n.data?.message && n.data?.title ? `${n.data.message} · ` : ''}{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          busy={uploadPhoto.isPending}
          onCancel={() => setCropFile(null)}
          onCropped={onCropped}
        />
      )}
    </div>
  )
}
