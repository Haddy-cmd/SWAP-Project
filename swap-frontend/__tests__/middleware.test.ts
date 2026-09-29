// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function visit(path: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return middleware(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} }))
}

const location = (res: Response) => {
  const to = res.headers.get('location')
  return to ? new URL(to).pathname + new URL(to).search : null
}

const signedIn = (role: string) => ({ swap_token: '1|abc', swap_role: role })

describe('route middleware', () => {
  it('sends a visitor without a session to login, keeping where they were going', () => {
    expect(location(visit('/admin/stipend?tab=1'))).toBe('/login?redirect=%2Fadmin%2Fstipend%3Ftab%3D1')
  })

  it('lets a signed-in user into their own area', () => {
    expect(location(visit('/recipient/hours', signedIn('recipient')))).toBeNull()
  })

  it("sends a signed-in user in another role's area to their own dashboard, not the login page", () => {
    expect(location(visit('/admin/stipend', signedIn('recipient')))).toBe('/recipient/dashboard')
  })

  it('treats an unknown role cookie as signed out', () => {
    expect(location(visit('/admin/stipend', { swap_token: '1|abc', swap_role: 'hacker' })))
      .toBe('/login?redirect=%2Fadmin%2Fstipend')
  })

  it('sends a signed-in user away from login and register', () => {
    expect(location(visit('/login', signedIn('admin')))).toBe('/admin/dashboard')
    expect(location(visit('/register', signedIn('applicant')))).toBe('/applicant/dashboard')
  })

  it('honours a same-site ?redirect= for a signed-in user, but never an external one', () => {
    expect(location(visit('/login?redirect=%2Fscan%3Ft%3Dabc', signedIn('recipient')))).toBe('/scan?t=abc')
    expect(location(visit('/login?redirect=%2F%2Fevil.example', signedIn('recipient')))).toBe('/recipient/dashboard')
  })

  it('shows login and register to visitors without a session', () => {
    expect(location(visit('/login'))).toBeNull()
    expect(location(visit('/register'))).toBeNull()
  })
})
