import { describe, it, expect, vi, beforeEach } from 'vitest'
import Cookies from 'js-cookie'
import { useAuthStore, AUTH_STORAGE_KEY } from '@/lib/store/authStore'
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

  it('persists the session in localStorage, shared by every tab', () => {
    useAuthStore.getState().setAuth(user, 'token-123')

    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')
    expect(stored.state.token).toBe('token-123')
    expect(stored.state.user.role).toBe('applicant')
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('moves a session saved by the old per-tab store into localStorage', async () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user, token: 'legacy-token', isAuthenticated: true }, version: 0,
    }))

    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState().token).toBe('legacy-token')
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}').state.token).toBe('legacy-token')
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
