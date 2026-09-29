import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/auth.types'
import Cookies from 'js-cookie'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const AUTH_STORAGE_KEY = 'swap-auth'

/**
 * One sign-in per browser, shared by every tab (localStorage), matching the
 * swap_token / swap_role cookies the route middleware reads. The store used to
 * live in per-tab sessionStorage, so a second account signed in elsewhere left
 * this tab and the cookies disagreeing, and the next reload, Back or phone
 * "desktop site" switch landed on the login page. Storage access can throw
 * (private mode, blocked site data), so every call is guarded.
 */
const browserStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) return stored
      // One-time move of a session signed in before the switch from sessionStorage.
      const legacy = window.sessionStorage.getItem(name)
      if (legacy !== null) {
        window.localStorage.setItem(name, legacy)
        window.sessionStorage.removeItem(name)
      }
      return legacy
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(name, value) } catch { /* storage unavailable: cookies still carry the session */ }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return
    try { window.localStorage.removeItem(name) } catch { /* ignore */ }
  },
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, token) => {
        // Also set cookies for SSR/middleware access
        Cookies.set('swap_token', token, { expires: 7, sameSite: 'lax' })
        Cookies.set('swap_role', user.role, { expires: 7, sameSite: 'lax' })

        set({ user, token, isAuthenticated: true, isLoading: false })
      },

      logout: () => {
        Cookies.remove('swap_token')
        Cookies.remove('swap_role')
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => browserStorage),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)

// Another tab signed in, switched account or signed out: pick it up here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY) void useAuthStore.persist.rehydrate()
  })
}
