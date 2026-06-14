import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types/auth.types'

const ROLE_ROUTES: Record<string, UserRole> = {
  '/applicant': 'applicant',
  '/recipient': 'recipient',
  '/supervisor': 'supervisor',
  '/admin': 'admin',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('swap_token')?.value
  const role = request.cookies.get('swap_role')?.value as UserRole | undefined

  const requiredRole = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1]

  if (!requiredRole) return NextResponse.next()

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (role !== requiredRole) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/applicant/:path*',
    '/recipient/:path*',
    '/supervisor/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/notifications/:path*',
  ],
}
