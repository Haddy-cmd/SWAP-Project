'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, Lock } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth.api'
import type { ApiError } from '@/types/api.types'

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
})

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

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const INPUT =
  'w-full rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15'

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore()
  const queryClient = useQueryClient()
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  const {
    register: rp,
    handleSubmit: hp,
    formState: { errors: pe },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const {
    register: rpw,
    handleSubmit: hpw,
    reset: resetPw,
    formState: { errors: pwe },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      const token = useAuthStore.getState().token ?? ''
      setAuth(updated, token)
      setProfileMsg('Profile updated successfully.')
    },
    onError: (err: ApiError) => setProfileMsg(err.message ?? 'Update failed.'),
  })

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) => authApi.updatePassword(data),
    onSuccess: () => { setPwMsg('Password changed successfully.'); resetPw() },
    onError: (err: ApiError) => setPwMsg(err.message ?? 'Change failed.'),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1E293B]">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7D1A1A] text-2xl font-bold text-white">
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-[#1E293B]">{user?.name}</p>
          <p className="text-sm text-[#8A6A6A] capitalize">{user?.role} · {user?.email}</p>
        </div>
      </div>

      {/* Profile form */}
      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-[#1E293B]">Personal Information</h2>
        {profileMsg && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            profileMsg.includes('success') ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
          }`}>{profileMsg}</div>
        )}
        <form onSubmit={hp((d) => updateProfile.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Full Name</label>
            <input {...rp('name')} className={INPUT} />
            {pe.name && <p className="mt-1 text-xs text-[#E74C3C]">{pe.name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Email</label>
            <input {...rp('email')} type="email" className={INPUT} />
            {pe.email && <p className="mt-1 text-xs text-[#E74C3C]">{pe.email.message}</p>}
          </div>
          <button type="submit" disabled={updateProfile.isPending}
            className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors">
            <Save className="h-4 w-4" />
            {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-[#1E293B]">Change Password</h2>
        {pwMsg && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            pwMsg.includes('success') ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
          }`}>{pwMsg}</div>
        )}
        <form onSubmit={hpw((d) => updatePassword.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Current Password</label>
            <input {...rpw('current_password')} type="password" className={INPUT} />
            {pwe.current_password && <p className="mt-1 text-xs text-[#E74C3C]">{pwe.current_password.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">New Password</label>
            <input {...rpw('password')} type="password" className={INPUT} />
            {pwe.password && <p className="mt-1 text-xs text-[#E74C3C]">{pwe.password.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Confirm New Password</label>
            <input {...rpw('password_confirmation')} type="password" className={INPUT} />
            {pwe.password_confirmation && <p className="mt-1 text-xs text-[#E74C3C]">{pwe.password_confirmation.message}</p>}
          </div>
          <button type="submit" disabled={updatePassword.isPending}
            className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors">
            <Lock className="h-4 w-4" />
            {updatePassword.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
