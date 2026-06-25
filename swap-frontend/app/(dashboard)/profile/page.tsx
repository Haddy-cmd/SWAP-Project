'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ChevronRight, ShieldCheck, Mail, Phone, Building2, CalendarDays, LogOut,
  Save, KeyRound, Lock, Bell, CheckCircle2, FileCheck, Clock,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { authApi } from '@/lib/api/auth.api'
import { notificationsApi } from '@/lib/api/notifications.api'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
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
  'h-12 w-full rounded-[11px] border border-[#EADFD4] bg-[#FBF7F2] px-3.5 text-sm text-[#2B1E1B] placeholder-[#B7A99F] focus:border-[#7C1B26] focus:outline-none disabled:cursor-not-allowed disabled:text-[#9A8A82]'
const LABEL = 'mb-[7px] block text-[12.5px] font-semibold text-[#5A4A45]'
const CARD = 'rounded-2xl border border-[#EFE5DA] bg-white p-7 shadow-[0_2px_8px_rgba(60,30,25,0.04)]'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function activityIcon(type: string) {
  if (/verif/i.test(type)) return { Icon: CheckCircle2, bg: '#EAF5EC', fg: '#4E9657' }
  if (/interview/i.test(type)) return { Icon: CalendarDays, bg: '#FDF3E2', fg: '#B8860B' }
  if (/applic/i.test(type)) return { Icon: FileCheck, bg: '#F1ECF7', fg: '#6B4E9A' }
  return { Icon: Bell, bg: '#FBEAEC', fg: '#7C1B26' }
}

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore()
  const { logout, isLoggingOut } = useAuth()
  const [tab, setTab] = useState<'profile' | 'security' | 'activity'>('profile')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  const isStudent = !!user?.profile
  const role = (user?.role ?? 'applicant') as UserRole
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
    defaultValues: { name: user?.name ?? '', contact_number: user?.profile?.contact_number ?? '' },
  })

  const {
    register: rpw,
    handleSubmit: hpw,
    reset: resetPw,
    formState: { errors: pwe },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) =>
      authApi.updateProfile({ name: data.name, ...(isStudent ? { contact_number: data.contact_number } : {}) }),
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
    <div className="mx-auto max-w-[1160px] text-[#241715]">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-[13px] text-[#A38A82]">
        <Link href={getRoleDashboard(role)} className="hover:text-[#7C1B26] transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-semibold text-[#7C1B26]">My Profile</span>
      </div>

      <div className="grid gap-[22px] lg:grid-cols-[336px_1fr] lg:items-start">
        {/* Identity rail */}
        <div className={`${CARD} flex flex-col items-center px-7 py-9 text-center`}>
          <div className="mb-[18px] flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gradient-to-br from-[#8A2230] to-[#651420] shadow-[0_12px_30px_rgba(108,22,32,0.3)]">
            <span className="font-serif text-[52px] font-semibold text-[#F3D9A0]">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="font-serif text-[23px] font-semibold text-[#241715]">{user.name}</div>
          <span className="mt-2 mb-5 inline-flex items-center gap-1.5 rounded-full bg-[#FBEAEC] px-3 py-1.5 text-[11px] font-bold text-[#7C1B26]">
            <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_LABEL[role]}
          </span>

          <div className="mb-5 flex w-full flex-col gap-3.5 text-left">
            <div className="flex items-center gap-3 text-[13px] text-[#5A4A45]">
              <Mail className="h-[18px] w-[18px] flex-none text-[#B79B7E]" /> <span className="truncate">{user.email}</span>
            </div>
            {isStudent && user.profile?.contact_number && (
              <div className="flex items-center gap-3 text-[13px] text-[#5A4A45]">
                <Phone className="h-[18px] w-[18px] flex-none text-[#B79B7E]" /> {user.profile.contact_number}
              </div>
            )}
            <div className="flex items-center gap-3 text-[13px] text-[#5A4A45]">
              <Building2 className="h-[18px] w-[18px] flex-none text-[#B79B7E]" /> <span className="truncate">{department}</span>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-[#5A4A45]">
              <CalendarDays className="h-[18px] w-[18px] flex-none text-[#B79B7E]" /> Member since {memberSince}
            </div>
          </div>

          <div className={`flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border text-[13px] font-semibold ${
            user.is_active ? 'border-[#D6EBD8] bg-[#EEF7EF] text-[#2C5A33]' : 'border-[#F0D4D7] bg-[#FCF2F3] text-[#A52834]'
          }`}>
            <span className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-[#4E9657]' : 'bg-[#C0392B]'}`} />
            {user.is_active ? 'Active Account' : 'Inactive Account'}
          </div>

          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="mt-3.5 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#F0D4D7] bg-[#FCF2F3] text-sm font-semibold text-[#A52834] transition-colors hover:bg-[#F8E8EA] disabled:opacity-60"
          >
            <LogOut className="h-[18px] w-[18px]" /> {isLoggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>

        {/* Content */}
        <div>
          {/* Tabs */}
          <div className="mb-[22px] inline-flex gap-1 rounded-xl bg-[#F1E7DC] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-[9px] px-5 py-2.5 text-[13.5px] transition-colors ${
                  tab === t.id ? 'bg-white font-semibold text-[#7C1B26] shadow-[0_1px_3px_rgba(60,30,25,0.08)]' : 'font-medium text-[#8A7A73] hover:text-[#5A4A45]'
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
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[13px] border border-[#EFE5DA] bg-[#EFE5DA]">
                {facts.map(([label, value]) => (
                  <div key={label} className="bg-white px-5 py-[18px]">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#A38A82]">{label}</div>
                    <div className="truncate font-serif text-[22px] font-semibold text-[#241715]">{value}</div>
                  </div>
                ))}
              </div>

              {/* Personal info */}
              <div className={CARD}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FBEAEC] text-[#7C1B26]"><ShieldCheck className="h-5 w-5" /></span>
                  <div>
                    <div className="text-[16px] font-bold text-[#241715]">Personal Information</div>
                    <div className="text-[12.5px] text-[#8A7A73]">Update your name{isStudent ? ' and contact number' : ''}</div>
                  </div>
                </div>

                {profileMsg && (
                  <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${profileMsg.includes('success') ? 'bg-green-50 text-[#1E8E50]' : 'bg-red-50 text-[#C0392B]'}`}>{profileMsg}</div>
                )}

                <form onSubmit={hp((d) => { setProfileMsg(null); updateProfile.mutate(d) })} className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>Full Name</label>
                    <input {...rp('name')} className={INPUT} />
                    {pe.name && <p className="mt-1 text-xs text-[#C0392B]">{pe.name.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Email Address</label>
                    <input value={user.email} disabled className={INPUT} />
                    <p className="mt-1 text-[11px] text-[#A38A82]">Managed by the DSA office</p>
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
                  {isStudent && user.profile?.program && (
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Program</label>
                      <input value={user.profile.program} disabled className={INPUT} />
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-3 sm:col-span-2">
                    <button type="submit" disabled={updateProfile.isPending}
                      className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 text-[14.5px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110 disabled:opacity-60">
                      <Save className="h-[18px] w-[18px]" /> {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div className="space-y-[22px]">
              <div className={CARD}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F1ECF7] text-[#6B4E9A]"><Lock className="h-5 w-5" /></span>
                  <div>
                    <div className="text-[16px] font-bold text-[#241715]">Change Password</div>
                    <div className="text-[12.5px] text-[#8A7A73]">Use 8+ characters with upper &amp; lower case and numbers</div>
                  </div>
                </div>

                {pwMsg && (
                  <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${pwMsg.includes('success') ? 'bg-green-50 text-[#1E8E50]' : 'bg-red-50 text-[#C0392B]'}`}>{pwMsg}</div>
                )}

                <form onSubmit={hpw((d) => { setPwMsg(null); updatePassword.mutate(d) })} className="space-y-4">
                  <div>
                    <label className={LABEL}>Current Password</label>
                    <input {...rpw('current_password')} type="password" placeholder="••••••••" className={INPUT} />
                    {pwe.current_password && <p className="mt-1 text-xs text-[#C0392B]">{pwe.current_password.message}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL}>New Password</label>
                      <input {...rpw('password')} type="password" placeholder="••••••••" className={INPUT} />
                      {pwe.password && <p className="mt-1 text-xs text-[#C0392B]">{pwe.password.message}</p>}
                    </div>
                    <div>
                      <label className={LABEL}>Confirm New Password</label>
                      <input {...rpw('password_confirmation')} type="password" placeholder="••••••••" className={INPUT} />
                      {pwe.password_confirmation && <p className="mt-1 text-xs text-[#C0392B]">{pwe.password_confirmation.message}</p>}
                    </div>
                  </div>
                  <button type="submit" disabled={updatePassword.isPending}
                    className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 text-[14.5px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,0.26)] transition hover:brightness-110 disabled:opacity-60">
                    <KeyRound className="h-[18px] w-[18px]" /> {updatePassword.isPending ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab === 'activity' && (
            <div className={CARD}>
              <div className="mb-5 text-[16px] font-bold text-[#241715]">Recent Activity</div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Clock className="h-8 w-8 text-[#C9B7AC]" />
                  <p className="mt-2 text-sm text-[#A38A82]">No recent activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {activity.map((n) => {
                    const { Icon, bg, fg } = activityIcon(n.data?.type ?? n.type)
                    return (
                      <div key={n.id} className="flex gap-3.5 border-b border-[#F4ECE1] py-3.5 last:border-0">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color: fg }}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="flex-1 leading-snug">
                          <div className="text-[13.5px] text-[#3F2F2A]">{n.data?.title ?? n.data?.message ?? 'Notification'}</div>
                          <div className="text-xs text-[#A38A82]">{n.data?.message && n.data?.title ? `${n.data.message} · ` : ''}{timeAgo(n.created_at)}</div>
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
    </div>
  )
}
