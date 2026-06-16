import { describe, it, expect, vi, beforeEach } from 'vitest'
import Cookies from 'js-cookie'
import { useAuthStore } from '@/lib/store/authStore'
import type { User } from '@/types/auth.types'

vi.mock('js-cookie', () => ({
  default: { set: vi.fn(), remove: vi.fn(), get: vi.fn() },
}))

const user: User = {
  id: 1,
  name: 'Ali Hassan',
  email: 'ali@student.msu-marawi.edu.ph',
  role: 'applicant',
  is_active: true,
  email_verified_at: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    vi.clearAllMocks()
  })

  it('setAuth stores the user and token and marks authenticated', () => {
    useAuthStore.getState().setAuth(user, 'token-123')
    const s = useAuthStore.getState()

    expect(s.user).toEqual(user)
    expect(s.token).toBe('token-123')
    expect(s.isAuthenticated).toBe(true)
  })

  it('setAuth writes the token and role cookies for SSR middleware', () => {
    useAuthStore.getState().setAuth(user, 'token-123')

    expect(Cookies.set).toHaveBeenCalledWith('swap_token', 'token-123', expect.any(Object))
    expect(Cookies.set).toHaveBeenCalledWith('swap_role', 'applicant', expect.any(Object))
  })

  it('logout clears state and removes cookies', () => {
    useAuthStore.getState().setAuth(user, 'token-123')
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()

    expect(s.user).toBeNull()
    expect(s.token).toBeNull()
    expect(s.isAuthenticated).toBe(false)
    expect(Cookies.remove).toHaveBeenCalledWith('swap_token')
    expect(Cookies.remove).toHaveBeenCalledWith('swap_role')
  })
})
