import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/lib/store/authStore'
import type { User } from '@/types/auth.types'

vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
  },
}))

const mockUser: User = {
  id: 1,
  name: 'Juan dela Cruz',
  email: 'juan@msumarawi.edu.ph',
  role: 'applicant',
  is_active: true,
  email_verified_at: null,
  created_at: '2024-01-01T00:00:00Z',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.logout())
  })

  it('initializes with null user and no token', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('setAuth stores user and token', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setAuth(mockUser, 'test-token-123'))
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe('test-token-123')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout clears user and token', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setAuth(mockUser, 'test-token-123'))
    act(() => result.current.logout())
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('setLoading toggles isLoading', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setLoading(true))
    expect(result.current.isLoading).toBe(true)
    act(() => result.current.setLoading(false))
    expect(result.current.isLoading).toBe(false)
  })
})
