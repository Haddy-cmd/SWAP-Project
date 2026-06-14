'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useAuthStore } from '@/lib/store/authStore'
import { toast } from '@/components/ui/use-toast'

declare global {
  interface Window {
    Pusher: typeof Pusher
    Echo: Echo
  }
}

export function useReverb() {
  const { user, token } = useAuthStore()
  const queryClient = useQueryClient()
  const echoRef = useRef<Echo | null>(null)

  useEffect(() => {
    if (!user || !token) return

    if (typeof window !== 'undefined') {
      window.Pusher = Pusher
    }

    const echo = new Echo({
      broadcaster: 'reverb',
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
      wsPort: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT ?? '8080', 10),
      wssPort: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT ?? '8080', 10),
      forceTLS: process.env.NODE_ENV === 'production',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    echoRef.current = echo

    echo
      .private(`user.${user.id}`)
      .listen('.HoursVerified', (event: { log_id: number; verified_hours: number; message: string }) => {
        queryClient.invalidateQueries({ queryKey: ['hours'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast({ title: 'Hours Verified', description: event.message })
      })
      .listen('.HoursRejected', (event: { log_id: number; feedback: string; message: string }) => {
        queryClient.invalidateQueries({ queryKey: ['hours'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast({ title: 'Hours Rejected', description: event.message, variant: 'destructive' })
      })
      .listen('.ApplicationStatusChanged', (event: { application_id: number; status: string; message: string }) => {
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast({ title: 'Application Update', description: event.message })
      })
      .listen('.InterviewScheduled', (event: { application_id: number; message: string }) => {
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast({ title: 'Interview Scheduled', description: event.message })
      })
      .listen('.NewNotification', (event: { title: string; message: string }) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast({ title: event.title, description: event.message })
      })

    return () => {
      echo.leave(`user.${user.id}`)
      echo.disconnect()
    }
  }, [user?.id, token, queryClient])

  return echoRef.current
}
