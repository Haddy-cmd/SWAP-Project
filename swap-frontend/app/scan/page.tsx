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
import { ClockConfirmSheet, type ClockChoice } from '@/components/attendance/ClockConfirmSheet'
import { useAuthStore } from '@/lib/store/authStore'
import { getBestPosition } from '@/lib/utils/geolocation'
import { formatDateTime } from '@/lib/utils/formatDate'

type Phase = 'working' | 'confirm' | 'cancelled' | 'selfie' | 'narrative' | 'success' | 'error'

/**
 * Deep-link target encoded into the office QR code. A recipient scans the posted
 * QR with their phone's native camera and lands here directly — no need to open
 * the portal and navigate first. A small pop-out (ClockConfirmSheet) then confirms the action,
 * offering only the one that fits:
 *   • Not clocked in  → Clock in (selfie when required), with the location.
 *   • Already clocked in → Clock out (Task Description first when missing).
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

      // Nothing happens until they confirm in the pop-out (it reads their shift fresh).
      setPhase('confirm')
    })()
  }, [router])

  const office = kind === 'out'

  function choose(choice: ClockChoice) {
    if (choice.action === 'in') {
      setKind('in')
      setSelfieRequired(choice.selfieRequired)
      if (choice.selfieRequired) setPhase('selfie')
      else void clockIn()
      return
    }
    setKind('out')
    setOpenLogId(choice.log.id)
    if (choice.log.has_narrative) {
      void clockOut(choice.log.id)
    } else {
      // The Task Description is required before clocking out.
      setNarrativeOpen(true)
      setPhase('narrative')
    }
  }

  return (
    <div className="flex min-h-app items-center justify-center bg-gradient-to-b from-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-center sm:p-8 shadow-xl">
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

        {phase === 'confirm' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">Office QR scanned</h1>
            <p className="mt-2 text-sm text-ink-500">Confirm whether you&apos;re clocking in or out.</p>
          </>
        )}

        {phase === 'cancelled' && (
          <>
            <h1 className="text-lg font-bold text-ink-900">Nothing was recorded</h1>
            <p className="mt-2 text-sm text-ink-500">You cancelled. Scan the office QR again when you&apos;re ready.</p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <button onClick={() => setPhase('confirm')}
                className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
                Choose again
              </button>
              <Link href="/recipient/dashboard" className="text-sm font-semibold text-brand-700 hover:underline">Go to Dashboard</Link>
            </div>
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
            <h1 className="mt-5 text-lg font-bold text-ink-900">Clock out</h1>
            <p className="mt-2 text-sm text-ink-500">
              You&apos;re clocked in. Write your task description to clock out — it prints on your duty slip.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => setNarrativeOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-danger-600 px-6 py-3 text-sm font-semibold text-white hover:bg-danger-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Write task description &amp; clock out
              </button>
            </div>
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
                  ? { borderColor: 'var(--color-success-200)', background: 'var(--color-success-50)', color: 'var(--text-success-800)' }
                  : { borderColor: 'var(--color-gold-300)', background: 'var(--color-warning-50)', color: 'var(--text-warning-800)' }}
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

      {phase === 'confirm' && <ClockConfirmSheet onChoose={choose} onCancel={() => setPhase('cancelled')} />}

      {/* The Task Description is required before clocking out an open session. */}
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
