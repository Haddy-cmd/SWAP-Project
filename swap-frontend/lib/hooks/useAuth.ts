'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import type { LoginCredentials, RegisterData } from '@/types/auth.types'

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      setAuth(data.data, data.token)
      queryClient.clear()

      const roleRoutes: Record<string, string> = {
        admin: '/admin',
        recipient: '/recipient',
        supervisor: '/supervisor',
        applicant: '/applicant',
      }
      router.push(roleRoutes[data.data.role] ?? '/applicant')
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (data) => {
      setAuth(data.data, data.token)
      router.push('/applicant')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout()
      queryClient.clear()
      router.push('/login')
    },
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })

  const updatePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; password: string; password_confirmation: string }) =>
      authApi.updatePassword(data),
  })

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    updatePassword: updatePasswordMutation.mutateAsync,
  }
}
