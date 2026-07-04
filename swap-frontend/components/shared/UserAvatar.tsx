'use client'

import type { CSSProperties } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import { avatarSrc } from '@/lib/utils/avatar'

/** Shown whenever a user hasn't uploaded a profile photo. */
export const DEFAULT_AVATAR = '/default-avatar.svg'

/**
 * Renders a user's profile photo when they have one, falling back to the
 * default silhouette avatar. Works for *any* user (not just the logged-in
 * one) — photos are streamed through the authenticated avatar endpoint using
 * the current viewer's token. Pass sizing/shape via `className`.
 */
export function UserAvatar({ name, avatarUrl, className, style }: {
  name?: string | null
  avatarUrl?: string | null
  className?: string
  style?: CSSProperties
}) {
  const token = useAuthStore((s) => s.token)
  const src = avatarSrc(avatarUrl, token) ?? DEFAULT_AVATAR
  return (
    <span
      className={`flex flex-none items-center justify-center overflow-hidden ${className ?? ''}`}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
    </span>
  )
}
