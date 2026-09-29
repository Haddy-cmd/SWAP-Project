import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types/auth.types'
import { getRoleDashboard } from '@/lib/utils/roleGuard'

const ROLE_ROUTES: Record<string, UserRole> = {
  '/applicant': 'applicant',
  '/recipient': 'recipient',
  '/supervisor': 'supervisor',
  '/admin': 'admin',
}

const ROLES = Object.values(ROLE_ROUTES)

// Pages a signed-in user has no reason to see: send them to their dashboard.
const GUEST_ONLY = ['/login', '/register']

/** A same-site path only (no "//host" or absolute URL), so ?redirect= can't leave the portal. */
function safeRedirect(target: string | null): string | null {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : null
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get('swap_token')?.value
  const cookieRole = request.cookies.get('swap_role')?.value
  const role = ROLES.includes(cookieRole as UserRole) ? (cookieRole as UserRole) : undefined

  if (GUEST_ONLY.includes(pathname)) {
    if (!token || !role) return NextResponse.next()
    const target = safeRedirect(request.nextUrl.searchParams.get('redirect')) ?? getRoleDashboard(role)
    return NextResponse.redirect(new URL(target, request.url))
  }

  const requiredRole = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1]

  if (!requiredRole) return NextResponse.next()

  if (!token || !role) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  // Signed in, but this area belongs to another role (a link from another
  // account, or a role that changed): their own dashboard, not the login page.
  if (role !== requiredRole) {
    return NextResponse.redirect(new URL(getRoleDashboard(role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/applicant/:path*',
    '/recipient/:path*',
    '/supervisor/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/notifications/:path*',
  ],
}
