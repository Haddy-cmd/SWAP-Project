'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { UserRole } from '@/types/auth.types'

const ROLES: UserRole[] = ['applicant', 'recipient', 'supervisor', 'admin']

/**
 * The landing header's sign-in button. A signed-in visitor (e.g. pressing Back
 * after logging in) gets "Go to dashboard" instead, so the page doesn't look like
 * they were signed out. Read after mount: the page itself is cached for everyone.
 */
export function AuthNavButton({ className }: { className: string }) {
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    const r = Cookies.get('swap_role') as UserRole | undefined
    setRole(Cookies.get('swap_token') && r && ROLES.includes(r) ? r : null)
  }, [])

  return role ? (
    <Link href={getRoleDashboard(role)} className={className}>Go to dashboard</Link>
  ) : (
    <Link href="/login" className={className}>Sign in</Link>
  )
}
