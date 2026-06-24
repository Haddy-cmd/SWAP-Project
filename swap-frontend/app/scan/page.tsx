'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { CheckCircle, AlertTriangle, Loader2, MapPin } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/store/authStore'
import { getCurrentPosition } from '@/lib/utils/geolocation'
import { formatDateTime } from '@/lib/utils/formatDate'

type Phase = 'working' | 'success' | 'error'

/**
 * Deep-link target encoded into the office QR code. A recipient can scan the
 * posted QR with their phone's native camera and land here directly — the page
 * reads the office token from the URL, grabs their location, and clocks them in
 * automatically, with no need to open the portal and navigate first.
 *
 * Auth note: the camera opens this in a fresh browser tab where the in-memory
 * (sessionStorage) auth store is empty. We fall back to the `swap_token` cookie
 * (set for 7 days at login) so the request is still authenticated; if there's no
 * cookie either, we bounce to /login and come straight back here afterward.
 */
export default function ScanPage() {
  const router = useRouter()
  const ran = useRef(false)
  const [phase, setPhase] = useState<Phase>('working')
  const [message, setMessage] = useState('Verifying your location…')

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = new URLSearchParams(window.location.search).get('t')
    if (!token) {
      setPhase('error')
      setMessage('Invalid QR code — no office found in the link.')
      return
    }

    const authToken = useAuthStore.getState().token ?? Cookies.get('swap_token')
    if (!authToken) {
      // Not signed in — send to login, then return here to finish clocking in.
      const back = `/scan?t=${encodeURIComponent(token)}`
      router.replace(`/login?redirect=${encodeURIComponent(back)}`)
      return
    }

    ;(async () => {
      // In a fresh tab the user object is missing; rehydrate it from the cookie
      // token so the rest of the portal works after they clock in.
      if (!useAuthStore.getState().user) {
        try {
          const user = await authApi.getProfile()
          useAuthStore.getState().setAuth(user, authToken)
        } catch {
          /* axios still uses the cookie token as a fallback */
        }
      }

      let coords
      try {
        coords = await getCurrentPosition()
      } catch {
        coords = undefined // backend rejects if the office requires geofencing
      }

      try {
        const res = await attendanceApi.timeInGeofence(token, coords)
        setPhase('success')
        setMessage(`Clocked in at ${formatDateTime(res.data.time_in)}`)
      } catch (e) {
        const err = e as { message?: string }
        setPhase('error')
        setMessage(err.message ?? 'Could not clock you in. Please try again.')
      }
    })()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#7A1717] to-[#531010] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        {phase === 'working' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF0F0]">
              <Loader2 className="h-8 w-8 animate-spin text-[#7D1A1A]" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-[#1E293B]">Clocking you in…</h1>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-[#8A6A6A]">
              <MapPin className="h-4 w-4" /> {message}
            </p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle className="h-8 w-8 text-[#27AE60]" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-[#1E293B]">You&apos;re clocked in!</h1>
            <p className="mt-2 text-sm text-[#8A6A6A]">{message}</p>
            <Link
              href="/recipient/dashboard"
              className="mt-6 inline-block rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-8 w-8 text-[#E74C3C]" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-[#1E293B]">Couldn&apos;t clock you in</h1>
            <p className="mt-2 text-sm text-[#E74C3C]">{message}</p>
            <Link
              href="/recipient/attendance"
              className="mt-6 inline-block rounded-xl border border-[#DCC5C5] px-6 py-3 text-sm font-semibold text-[#7D1A1A] hover:bg-[#FAF7F7] transition-colors"
            >
              Open Attendance
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
