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
      name: 'swap-auth',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // In SSR context (window undefined) return null
          if (typeof window === 'undefined') return null
          return window.sessionStorage.getItem(name)
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return
          window.sessionStorage.setItem(name, value)
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return
          window.sessionStorage.removeItem(name)
        },
      })),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
