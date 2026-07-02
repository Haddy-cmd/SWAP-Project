'use client'

import type { CSSProperties } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import { avatarSrc } from '@/lib/utils/avatar'

function initialsOf(name?: string | null) {
  return (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

/**
 * Renders a user's profile photo when they have one, falling back to their
 * initials. Works for *any* user (not just the logged-in one) — the photo is
 * streamed through the authenticated avatar endpoint using the current viewer's
 * token. Pass sizing/shape via `className` and the initials colors via `style`.
 */
export function UserAvatar({ name, avatarUrl, className, style }: {
  name?: string | null
  avatarUrl?: string | null
  className?: string
  style?: CSSProperties
}) {
  const token = useAuthStore((s) => s.token)
  const src = avatarSrc(avatarUrl, token)
  return (
    <span
      className={`flex flex-none items-center justify-center overflow-hidden ${className ?? ''}`}
      style={src ? undefined : style}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
