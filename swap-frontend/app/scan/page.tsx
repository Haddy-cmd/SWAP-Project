'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { CheckCircle, AlertTriangle, Loader2, MapPin, LogOut, FileText } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { authApi } from '@/lib/api/auth.api'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import { SelfieCapture } from '@/components/attendance/SelfieCapture'
import { useAuthStore } from '@/lib/store/authStore'
import { getBestPosition } from '@/lib/utils/geolocation'
import { formatDateTime } from '@/lib/utils/formatDate'

type Phase = 'working' | 'selfie' | 'narrative' | 'success' | 'error'

/**
 * Deep-link target encoded into the office QR code. A recipient scans the posted
 * QR with their phone's native camera and lands here directly — no need to open
 * the portal and navigate first. The scan toggles their attendance:
 *   • Not clocked in  → grab location and clock in.
 *   • Already clocked in → require a narrative report, then clock out.
 *
 * Auth note: the camera opens this in a fresh browser tab where the in-memory
 * (sessionStorage) auth store is empty. We fall back to the `swap_token` cookie
 * (set for 7 days at login) so the request is still authenticated; if there's no
 * cookie either, we bounce to /login and come straight back here afterward.
 */
export default function ScanPage() {
  const router = useRouter()
  const ran = useRef(false)
  const tokenRef = useRef<string>('')
  const [phase, setPhase] = useState<Phase>('working')
  const [message, setMessage] = useState('Verifying your location…')
  const [kind, setKind] = useState<'in' | 'out'>('in')
  const [openLogId, setOpenLogId] = useState<number | null>(null)
  const [narrativeOpen, setNarrativeOpen] = useState(false)
  const [premises, setPremises] = useState<{ ok: boolean; text: string } | null>(null)
  // Whether this student's supervisor requires a clock-in selfie. Default to
  // true until the assignment says otherwise, so the step is never skipped by a
  // failed lookup; the backend enforces the same rule either way.
  const [selfieRequired, setSelfieRequired] = useState(true)

  async function clockIn(photo?: Blob) {
    setKind('in')
    setPhase('working')
    setMessage('Verifying your location…')
    let coords
    try {
      coords = await getBestPosition()
    } catch {
      coords = undefined // backend rejects if the office requires geofencing
    }
    try {
      const res = await attendanceApi.timeInGeofence(tokenRef.current, coords, photo)
      // A successful geofenced clock-in means the student was on the premises;
      // location_flagged means the GPS fix was too coarse to fully trust.
      setPremises(
        res.data.location_flagged
          ? { ok: false, text: 'Your location couldn’t be fully verified — GPS signal was weak, so your supervisor may review this clock-in.' }
          : { ok: true, text: 'Confirmed: you’re inside the office premises.' },
      )
      setPhase('success')
      setMessage(`Clocked in at ${formatDateTime(res.data.time_in)}`)
    } catch (e) {
      const err = e as { message?: string }
      setPhase('error')
      setMessage(err.message ?? 'Could not clock you in. Please try again.')
    }
  }

  async function clockOut(logId: number) {
    setKind('out')
    setPremises(null)
    setPhase('working')
    setMessage('Recording your clock-out…')
    let coords
    try {
      coords = await getBestPosition()
    } catch {
      coords = undefined
    }
    try {
      const res = await attendanceApi.timeOut(logId, tokenRef.current, coords)
      setPhase('success')
      setMessage(`Clocked out at ${formatDateTime(res.data.time_out!)}`)
    } catch (e) {
      const err = e as { message?: string }
      setPhase('error')
      setMessage(err.message ?? 'Could not clock you out. Please try again.')
    }
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = new URLSearchParams(window.location.search).get('t')
    if (!token) {
      setPhase('error')
      setMessage('Invalid QR code — no office found in the link.')
      return
    }
    tokenRef.current = token

    const authToken = useAuthStore.getState().token ?? Cookies.get('swap_token')
    if (!authToken) {
      // Not signed in — send to login, then return here to finish.
      const back = `/scan?t=${encodeURIComponent(token)}`
      router.replace(`/login?redirect=${encodeURIComponent(back)}`)
      return
    }

    ;(async () => {
      // In a fresh tab the user object is missing; rehydrate it from the cookie
      // token so the rest of the portal works after the scan.
      if (!useAuthStore.getState().user) {
        try {
          const user = await authApi.getProfile()
          useAuthStore.getState().setAuth(user, authToken)
        } catch {
          /* axios still uses the cookie token as a fallback */
        }
      }

      // Decide: clock in, or clock out an already-open session.
      let current
      try {
        current = await attendanceApi.getCurrentLog()
      } catch {
        current = null
      }

      if (current?.id) {
        // Already clocked in → this scan clocks them out.
        if (current.has_narrative) {
          await clockOut(current.id)
        } else {
          // Narrative required before clocking out.
          setKind('out')
          setOpenLogId(current.id)
          setNarrativeOpen(true)
          setPhase('narrative')
        }
      } else {
        setKind('in')

        // The supervisor decides whether a proof-of-presence selfie is needed.
        let needsSelfie = true
        try {
          const assignment = await attendanceApi.getMyAssignment()
          needsSelfie = assignment?.selfie_required ?? true
        } catch {
          needsSelfie = true // couldn't ask — take the safe path
        }

        setSelfieRequired(needsSelfie)

        if (needsSelfie) {
          setPhase('selfie')
        } else {
          // Nothing else to collect: clock straight in.
          await clockIn()
        }
      }
    })()
  }, [router])

  const office = kind === 'out'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        {phase === 'working' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">
              {office ? 'Clocking you out…' : 'Clocking you in…'}
            </h1>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-ink-500">
              <MapPin className="h-4 w-4" /> {message}
            </p>
          </>
        )}

        {phase === 'selfie' && (
          <SelfieCapture
            onCapture={(blob) => clockIn(blob)}
            onSkip={() => clockIn()}
            required={selfieRequired}
          />
        )}

        {phase === 'narrative' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <FileText className="h-8 w-8 text-brand-700" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">Submit your narrative</h1>
            <p className="mt-2 text-sm text-ink-500">
              You&apos;re clocked in. Submit a short narrative report to clock out.
            </p>
            <button
              onClick={() => setNarrativeOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-danger-600 px-6 py-3 text-sm font-semibold text-white hover:bg-danger-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Open narrative form
            </button>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">
              {office ? "You're clocked out!" : "You're clocked in!"}
            </h1>
            <p className="mt-2 text-sm text-ink-500">{message}</p>

            {premises && kind === 'in' && (
              <div
                className="mx-auto mt-4 flex max-w-xs items-start gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium"
                style={premises.ok
                  ? { borderColor: '#B4E1CF', background: '#EFF8F4', color: '#145643' }
                  : { borderColor: '#F4D76E', background: '#FFFBEB', color: '#92400E' }}
              >
                {premises.ok
                  ? <MapPin className="mt-0.5 h-4 w-4 flex-none text-success-600" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-gold-600" />}
                <span>{premises.text}</span>
              </div>
            )}

            <Link
              href="/recipient/dashboard"
              className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
              <AlertTriangle className="h-8 w-8 text-danger-600" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-danger-600">{message}</p>
            <Link
              href="/recipient/attendance"
              className="mt-6 inline-block rounded-xl border border-ink-300 px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-ink-50 transition-colors"
            >
              Open Attendance
            </Link>
          </>
        )}
      </div>

      {/* Narrative is required before clocking out an open session. */}
      {narrativeOpen && openLogId && (
        <NarrativeModal
          logId={openLogId}
          clockingOut={phase === 'working'}
          onClose={() => setNarrativeOpen(false)}
          onSubmitted={() => {
            setNarrativeOpen(false)
            clockOut(openLogId)
          }}
        />
      )}
    </div>
  )
}
