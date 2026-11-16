'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { authApi } from '@/lib/api/auth.api'
import { avatarSrc } from '@/lib/utils/avatar'
import { AvatarCropper } from '@/components/shared/AvatarCropper'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { User, UserRole } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'
import { collegeDisplay } from '@/lib/constants/colleges'
import { CARD } from './ui'

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  recipient: 'Recipient',
  applicant: 'Applicant',
}

const YEAR = ['', '1st year', '2nd year', '3rd year', '4th year', '5th year', '6th year']

/** Left column: cover, photo, name and pills, the facts the DSA keeps, and Sign out. */
export function ProfileAside({ user }: { user: User }) {
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const queryClient = useQueryClient()
  const { logout, isLoggingOut } = useAuth()
  const { notify } = useFeedback()
  const [photoMsg, setPhotoMsg] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const role = user.role
  const isStudent = !!user.profile
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    : '—'

  const afterPhoto = (updated: User, title: string) => {
    setAuth(updated, useAuthStore.getState().token ?? '')
    for (const key of ['supervisor-students', 'admin-users', 'student-summary']) queryClient.invalidateQueries({ queryKey: [key] })
    setPhotoMsg(null)
    notify({ title })
  }

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => authApi.uploadPhoto(file),
    onSuccess: (updated) => { setCropFile(null); afterPhoto(updated, 'Profile photo updated') },
    onError: (err: ApiError) => setPhotoMsg(err.message ?? 'Photo upload failed.'),
  })
  const removePhoto = useMutation({
    mutationFn: () => authApi.removePhoto(),
    onSuccess: (updated) => afterPhoto(updated, 'Profile photo removed'),
    onError: (err: ApiError) => setPhotoMsg(err.message ?? 'Could not remove photo.'),
  })

  const facts: [string, string][] = isStudent
    ? [
        ['Student ID', user.profile?.student_id_number || '—'],
        ['College', collegeDisplay(user.profile?.college)],
        ['Program', user.profile?.program || '—'],
        ['Year level', YEAR[user.profile?.year_level ?? 0] || '—'],
        ['Member since', memberSince],
      ]
    : [
        ['Employee ID', user.employee_id || 'Not set'],
        ['Office', role === 'admin' ? 'Division of Student Affairs' : (user.office_name ?? 'Unassigned office')],
        ...(role === 'admin' ? [['Position', user.position_title || 'Not set'] as [string, string]] : []),
        ['Member since', memberSince],
      ]

  return (
    <aside className={`${CARD} overflow-hidden`}>
      {/* Phones: a shorter cover and avatar so the tabs and form start near the top. */}
      <div className="h-16 sm:h-[92px]" style={{ background: 'var(--hero-gradient)' }} />
      <div className="-mt-[42px] flex flex-col items-center px-4 pb-4 text-center sm:-mt-[52px] sm:px-6 sm:pb-6">
        <div className="relative">
          <div className="h-[84px] w-[84px] overflow-hidden rounded-full sm:h-[104px] sm:w-[104px] border-4 border-surface bg-accent-soft shadow-[0_8px_20px_rgba(20,40,30,.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(user.avatar_url, token) ?? '/default-avatar.svg'} alt={user.name} className="h-full w-full object-cover" />
          </div>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploadPhoto.isPending}
            title="Change photo" aria-label="Change photo"
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-white shadow-md transition-colors hover:bg-accent-hover disabled:opacity-60">
            {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoMsg(null); setCropFile(f) } e.target.value = '' }} />
        </div>
        {user.avatar_url && (
          <button type="button" onClick={() => removePhoto.mutate()} disabled={removePhoto.isPending}
            className="mt-1.5 text-[11.5px] font-semibold text-ink-400 transition-colors hover:text-danger-700 disabled:opacity-60">
            {removePhoto.isPending ? 'Removing…' : 'Remove photo'}
          </button>
        )}
        {photoMsg && <p className="mt-1 text-xs text-danger-700">{photoMsg}</p>}
        {role === 'applicant' && user.avatar_url && !photoMsg && (
          <p className="mt-1 max-w-[220px] text-[11.5px] text-ink-400">Your 2×2 photo from your application. Use the camera to replace it.</p>
        )}

        <h1 className="mt-2.5 break-words font-serif text-[20px] sm:mt-3 sm:text-[22px] font-semibold leading-tight text-ink-950">{user.name}</h1>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-strong">
            <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_LABEL[role]}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            user.is_active ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-700'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-success-600' : 'bg-danger-700'}`} />
            {user.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="mt-2 max-w-full truncate text-[12.5px] text-ink-500">{user.email}</p>
      </div>

      <dl className="border-t border-ink-900/[.06] px-4 py-2.5 sm:px-6 sm:py-4">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-1.5 text-[13px] sm:py-2">
            <dt className="flex-none text-ink-500">{label}</dt>
            <dd className="min-w-0 break-words text-right font-semibold text-ink-900">{value}</dd>
          </div>
        ))}
        {isStudent && <p className="mt-2 text-[11.5px] text-ink-400">School details are managed by the DSA office.</p>}
      </dl>

      {/* Phones sign out from the menu (sidebar), which keeps this card short. */}
      <div className="hidden border-t border-ink-900/[.06] p-4 sm:block">
        <button type="button" onClick={() => logout()} disabled={isLoggingOut}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-danger-200 text-[13.5px] font-semibold text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-60">
          <LogOut className="h-4 w-4" /> {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {cropFile && (
        <AvatarCropper file={cropFile} busy={uploadPhoto.isPending} onCancel={() => setCropFile(null)}
          onCropped={(blob) => uploadPhoto.mutate(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))} />
      )}
    </aside>
  )
}
