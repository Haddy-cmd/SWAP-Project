'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getRoleDashboard } from '@/lib/utils/roleGuard'
import type { UserRole } from '@/types/auth.types'

const AREAS: Record<string, UserRole> = {
  '/applicant': 'applicant',
  '/recipient': 'recipient',
  '/supervisor': 'supervisor',
  '/admin': 'admin',
}

/** The role whose area the current page belongs to, if any (/profile etc. belong to everyone). */
function areaRole(pathname: string): UserRole | undefined {
  return Object.entries(AREAS).find(([prefix]) => pathname.startsWith(prefix))?.[1]
}

/**
 * Keeps this tab's sign-in current, rendered once by the dashboard shell:
 *  - on load, re-reads the account from the API, which refills an empty store and
 *    rewrites a stale swap_role cookie (an applicant placed since they signed in is now
 *    a recipient), then moves to the right dashboard if the page belongs to another role;
 *  - follows changes made in other tabs: signed out there → login; switched account
 *    there → that account's dashboard.
 * A revoked or expired token surfaces as a 401, which the API client already handles.
 */
export function SessionSync() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    const goToOwnArea = (role: UserRole) => {
      const area = areaRole(window.location.pathname)
      if (area && area !== role) router.replace(getRoleDashboard(role))
    }

    if (!ran.current) {
      ran.current = true
      const token = useAuthStore.getState().token ?? Cookies.get('swap_token')
      if (token) {
        authApi.getProfile()
          .then((user) => {
            useAuthStore.getState().setAuth(user, token)
            goToOwnArea(user.role)
          })
          .catch(() => { /* offline or a cold API: keep the stored session */ })
      }
    }

    return useAuthStore.subscribe((state, prev) => {
      if (prev.token && !state.token) {
        router.replace('/login')
      } else if (state.user && state.user.role !== prev.user?.role) {
        goToOwnArea(state.user.role)
      }
    })
  }, [router])

  return null
}
