'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { useAuthStore } from '@/lib/store/authStore'
import { useUIStore } from '@/lib/store/uiStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { UserRole } from '@/types/auth.types'

/**
 * Writing to the DSA moved into the SWAP Assistant (its "Ask the DSA" tab). This
 * route stays so older links keep working — the concern-reply email, concern
 * notifications and bookmarks: it opens the chat on that tab over the user's
 * dashboard. Admins answer concerns from Admin → Concerns.
 */
export default function HelpRedirectPage() {
  const router = useRouter()
  const openChat = useUIStore((s) => s.openChat)
  const storeRole = useAuthStore((s) => s.user?.role)

  useEffect(() => {
    const role = (storeRole ?? Cookies.get('swap_role')) as UserRole | undefined
    if (!role) return
    if (role === 'admin') {
      router.replace('/admin/concerns')
      return
    }
    openChat('dsa')
    router.replace(getRoleDashboard(role))
  }, [storeRole, openChat, router])

  return <p className="py-10 text-center text-sm text-ink-500">Opening the SWAP Assistant…</p>
}
