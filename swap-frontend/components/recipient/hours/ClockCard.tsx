'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, CheckCircle2, AlertTriangle, MapPin, MapPinOff, ScanLine, FileText, Loader2, LocateFixed, Navigation, Building2, X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import { SelfieCapture } from '@/components/attendance/SelfieCapture'
import { QrScanner } from '@/components/attendance/QrScanner'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getCurrentPosition, getBestPosition, distanceMeters, type Coords } from '@/lib/utils/geolocation'
import type { Assignment, Office } from '@/types/assignment.types'
import type { HoursSummary } from '@/types/attendance.types'
import { CARD, fmtClock, pad } from './ui'

const GRACE_MS = 10 * 60 * 1000 // auto clock-out after 10 min outside the geofence
const POLL_MS = 15_000

type LocState =
  | { kind: 'checking' }
  | { kind: 'inside'; meters: number }
  | { kind: 'outside'; meters: number }
  | { kind: 'off' }
  | { kind: 'unchecked' } // the office doesn't use a geofence

/**
 * Where the student is, before clocking in: inside the office area, how far away, or location
 * off. Informational only — the server decides on clock-in (it allows for the GPS accuracy
 * the same way, capped at 100 m).
 */
function useLocationStatus(office: Office | null | undefined, active: boolean) {
  const [state, setState] = useState<LocState>({ kind: 'checking' })
  const geofenced = !!office?.geofence_enabled && office.latitude != null && office.longitude != null

  const check = useCallback(async () => {
    if (!office || !geofenced) { setState({ kind: 'unchecked' }); return }
    setState({ kind: 'checking' })
    try {
      const pos = await getCurrentPosition()
      const meters = distanceMeters(pos.latitude, pos.longitude, Number(office.latitude), Number(office.longitude))
      const inside = meters <= (office.radius_meters ?? 100) + Math.min(pos.accuracy ?? 0, 100)
      setState(inside ? { kind: 'inside', meters } : { kind: 'outside', meters })
    } catch {
      setState({ kind: 'off' })
    }
  }, [office, geofenced])

  useEffect(() => { if (active) check() }, [active, check])
  return { state, check }
}

/**
 * Hours & Attendance → the clock: scan or paste the office QR token, clock in (selfie when the
 * supervisor asks for one), write the task description and clock out. While clocked in at a
 * geofenced office the location is watched, with an automatic clock-out after 10 minutes away.
 */
export function ClockCard({ summary, assignment }: { summary: HoursSummary | undefined; assignment: Assignment | null | undefined }) {
  const queryClient = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [openLogId, setOpenLogId] = useState<number | null>(null)
  const [qrToken, setQrToken] = useState('')
  const [geoWarning, setGeoWarning] = useState<string | null>(null)
  const [narrativeOpen, setNarrativeOpen] = useState(false)
  const [selfieOpen, setSelfieOpen] = useState(false)
  // "Enter the code instead" shown; the in-page scanner for clocking out.
  const [showCode, setShowCode] = useState(false)
  const [scanOut, setScanOut] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const outsideSinceRef = useRef<number | null>(null)

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // Restore clock-in state from the server so an open log survives reloads / re-login, and
  // poll while one is open so a clock-out (automatic, or from another device) is noticed.
  const { data: currentLog } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: (query) => (query.state.data ? 20_000 : false),
  })
  useEffect(() => { setOpenLogId(currentLog?.id ?? null) }, [currentLog])

  // The supervisor decides whether a clock-in selfie is needed; assume it is until we know.
  const selfieRequired = assignment?.selfie_required ?? true

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
    queryClient.invalidateQueries({ queryKey: ['my-logs'] })
    queryClient.invalidateQueries({ queryKey: ['recipient-progress'] })
  }

  const timeIn = useMutation({
    mutationFn: async (photo?: Blob) => {
      let coords: Coords | undefined
      try { coords = await getBestPosition() } catch { coords = undefined }
      return attendanceApi.timeInGeofence(qrToken, coords, photo)
    },
    onSuccess: (res) => {
      setOpenLogId(res.data.id)
      setSelfieOpen(false)
      const premises = res.data.location_flagged ? 'Your location couldn’t be fully verified (weak GPS).' : 'You’re inside the office premises.'
      notify({ title: 'Clocked in', detail: `${formatDateTime(res.data.time_in)}${res.data.office?.name ? ` · ${res.data.office.name}` : ''}\n${premises}` })
      invalidate()
      setQrToken(''); setShowCode(false)
    },
    onError: (err: { message?: string }) => { setSelfieOpen(false); notifyError(err, 'Could not clock you in') },
  })

  const timeOut = useMutation({
    // A scanned token is passed straight in; otherwise the typed one is used.
    mutationFn: async (token?: string) => {
      if (!openLogId) throw new Error('No open log')
      let coords: Coords | undefined
      try { coords = await getBestPosition() } catch { coords = undefined }
      return attendanceApi.timeOut(openLogId, token ?? qrToken, coords)
    },
    onSuccess: (res) => {
      setOpenLogId(null); setGeoWarning(null); outsideSinceRef.current = null
      const hours = Number(res.data.duration_hours) || 0
      notify({ title: 'Clocked out', detail: `${hours ? `${hours.toFixed(2)}h logged · ` : ''}out at ${formatDateTime(res.data.time_out!)}\nYour supervisor will verify the hours.` })
      invalidate()
      setQrToken(''); setShowCode(false)
    },
    onError: (err: { message?: string }) => notifyError(err, 'Could not clock you out'),
  })

  const autoClockOut = useMutation({
    mutationFn: (coords?: { latitude: number; longitude: number; accuracy?: number }) => {
      if (!openLogId) throw new Error('No open log')
      return attendanceApi.autoClockOut(openLogId, coords)
    },
    onSuccess: () => {
      setOpenLogId(null); setGeoWarning(null); outsideSinceRef.current = null
      notify({ tone: 'info', title: 'Clocked out automatically', detail: 'You left the office premises. Add your task description under Time logs below.' })
      invalidate()
    },
  })

  // Clock out: straight out when the Task Description is in, otherwise ask for it first.
  const handleClockOut = (token?: string) => (currentLog?.has_narrative ? timeOut.mutate(token) : setNarrativeOpen(true))
  // A scanned office QR: keep it (the task description may come first), then clock out.
  const onScanOut = (token: string) => {
    setScanOut(false)
    setQrToken(token)
    handleClockOut(token)
  }

  const clockedIn = !!openLogId
  const completed = !!summary && summary.required > 0 && summary.remaining <= 0
  const office = (clockedIn ? currentLog?.office : null) ?? assignment?.office ?? null
  const officeName = office?.name ?? 'your office'
  // Offices can switch auto clock-out off (errands off the premises); then nothing is watched.
  const monitoring = clockedIn && !!office?.geofence_enabled && office.auto_clock_out !== false && office.latitude != null && office.longitude != null

  // Background geofence watch → auto clock-out after the grace period (set up once per session).
  const checkLocationRef = useRef<() => void>(() => {})
  checkLocationRef.current = async () => {
    if (!office || office.latitude == null || office.longitude == null) return
    try {
      const pos = await getCurrentPosition()
      const dist = distanceMeters(pos.latitude, pos.longitude, Number(office.latitude), Number(office.longitude))
      const inside = dist <= (office.radius_meters ?? 100) + Math.min(pos.accuracy ?? 0, 100)
      if (inside) { outsideSinceRef.current = null; setGeoWarning(null); return }
      if (outsideSinceRef.current == null) outsideSinceRef.current = Date.now()
      const elapsed = Date.now() - outsideSinceRef.current
      if (elapsed >= GRACE_MS) {
        autoClockOut.mutate({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy })
      } else {
        const mins = Math.ceil((GRACE_MS - elapsed) / 60_000)
        setGeoWarning(`You appear to have left ${office.name}. You'll be clocked out automatically in ~${mins} min if you don't return.`)
      }
    } catch { /* transient GPS error: keep the prior state */ }
  }
  useEffect(() => {
    if (!monitoring) return
    checkLocationRef.current()
    const id = setInterval(() => checkLocationRef.current(), POLL_MS)
    return () => clearInterval(id)
  }, [monitoring])

  // Before clocking in: where am I? (never blocks the button)
  const { state: loc, check: recheck } = useLocationStatus(assignment?.office, !clockedIn && !!assignment && !completed)

  const elapsed = (() => {
    if (!clockedIn || !currentLog?.time_in) return '00:00:00'
    const s = Math.max(0, Math.floor((now - new Date(currentLog.time_in).getTime()) / 1000))
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  })()

  const location = clockedIn
    ? geoWarning
      ? { tone: 'warn', Icon: AlertTriangle, title: 'You appear to have left the premises', text: geoWarning }
      : { tone: 'ok', Icon: MapPin, title: `On duty at ${officeName}`, text: monitoring ? 'Location is checked while you’re clocked in' : 'This office doesn’t watch your location' }
    : loc.kind === 'checking' ? { tone: 'muted', Icon: Navigation, title: 'Checking your location…', text: 'Allow location if your browser asks.' }
    : loc.kind === 'inside' ? { tone: 'ok', Icon: MapPin, title: `You’re at ${officeName}`, text: 'Location on · inside the office area' }
    : loc.kind === 'outside' ? { tone: 'warn', Icon: MapPinOff, title: `About ${Math.round(loc.meters).toLocaleString()} m from ${officeName}`, text: 'Move closer to the office to clock in.' }
    : loc.kind === 'off' ? { tone: 'bad', Icon: MapPinOff, title: 'Location is off', text: 'Allow location in your browser. You must be inside the office to clock in.' }
    : { tone: 'muted', Icon: MapPin, title: officeName, text: 'This office doesn’t check location.' }
  const toneStyle = {
    ok: { background: 'var(--color-success-50)', borderColor: 'var(--color-success-200)', color: 'var(--text-success-700)' },
    warn: { background: 'var(--color-warning-50)', borderColor: 'var(--color-warning-200)', color: 'var(--text-warning-700)' },
    bad: { background: 'var(--color-danger-50)', borderColor: 'var(--color-danger-200)', color: 'var(--text-red-strong)' },
    muted: { background: 'var(--color-surface-2)', borderColor: 'var(--color-ink-200)', color: 'var(--text-ink-500)' },
  }[location.tone as 'ok' | 'warn' | 'bad' | 'muted']

  const clockIn = () => (selfieRequired ? setSelfieOpen(true) : timeIn.mutate(undefined))
  const hasCode = qrToken.trim().length > 0
  // "Camera not working?": the office code typed or pasted, then Clock in / Clock out.
  const codeEntry = (
    <div className="flex gap-2">
      <input value={qrToken} onChange={(e) => setQrToken(e.target.value)} aria-label="Office code" autoFocus
        placeholder="Paste the office code"
        className="h-[46px] min-w-0 flex-1 rounded-xl border-[1.5px] border-ink-200 bg-surface px-3.5 text-sm text-ink-950 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15" />
      <button type="button" disabled={!hasCode || timeIn.isPending || timeOut.isPending}
        onClick={() => (clockedIn ? handleClockOut() : clockIn())}
        className={`h-[46px] flex-none rounded-xl border-[1.5px] bg-surface px-4 text-[13.5px] font-bold disabled:cursor-not-allowed ${
          hasCode ? (clockedIn ? 'border-danger-700 text-danger-700' : 'border-accent text-accent-strong') : 'border-ink-200 text-ink-400'}`}>
        {clockedIn ? (timeOut.isPending ? 'Recording…' : 'Clock out') : timeIn.isPending ? 'Verifying…' : 'Clock in'}
      </button>
    </div>
  )
  const codeLink = (
    <button type="button" onClick={() => setShowCode(true)} className="self-center text-[13px] font-semibold text-accent hover:text-accent-strong">
      Camera not working? Enter the code instead
    </button>
  )

  return (
    <div className={`${CARD} flex flex-col gap-4 p-[22px]`}>
      <div className="flex items-center justify-between gap-2.5">
        <span className={`inline-flex flex-none items-center gap-[7px] whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold ${clockedIn ? 'bg-accent-soft text-accent-strong' : 'bg-surface-3 text-ink-600'}`}>
          <span className={`h-2 w-2 rounded-full ${clockedIn ? 'animate-live bg-accent-bright' : 'bg-ink-350'}`} />
          {clockedIn ? 'On duty' : completed ? 'All hours done' : 'Not clocked in'}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-right text-[12.5px] leading-snug text-ink-500">
          <Building2 className="h-4 w-4 flex-none" /><span className="truncate">{officeName}</span>
        </span>
      </div>

      {clockedIn ? (
        <>
          <div className="flex flex-col items-center gap-1 pb-1 pt-[18px]">
            <p className="text-[44px] font-extrabold leading-none tracking-[-.02em] tabular-nums text-ink-950">{elapsed}</p>
            <p className="mt-1 text-[13px] text-ink-500">Since {fmtClock(currentLog?.time_in)}</p>
          </div>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-ink-500">
            <FileText className="h-3.5 w-3.5 flex-none" />
            {currentLog?.has_narrative ? 'Task description saved, ready to clock out.' : 'You’ll write your task description when you clock out.'}
          </p>
          {/* The office QR is needed to clock out as well as in. */}
          <button type="button" onClick={() => setScanOut(true)} disabled={timeOut.isPending}
            className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-danger-700 text-[15px] font-bold text-white hover:bg-danger-800 disabled:opacity-60">
            <LogOut className="h-[21px] w-[21px]" /> {timeOut.isPending ? 'Recording…' : 'Scan QR to clock out'}
          </button>
          {showCode ? codeEntry : codeLink}
        </>
      ) : completed ? (
        <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-800">
          <CheckCircle2 className="h-4 w-4 flex-none" /> You have completed all your required service hours. No further clock-ins are needed.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[20px] font-extrabold tracking-[-.01em] text-ink-950">Arrived at your office?</p>
            <p className="mt-0.5 text-[13.5px] text-ink-500">Scan the QR code posted at the office to start your shift.</p>
          </div>
          <Link href="/recipient/attendance/scan"
            className="flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] bg-accent text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(23,129,95,.25)] hover:bg-accent-hover hover:text-white">
            <ScanLine className="h-[22px] w-[22px]" /> Scan QR to clock in
          </Link>
          {showCode ? codeEntry : codeLink}
        </div>
      )}

      {(!completed || clockedIn) && (
        <div className="mt-auto flex items-center gap-3 rounded-xl border px-3.5 py-2.5" style={{ background: toneStyle.background, borderColor: toneStyle.borderColor }}>
          <location.Icon className="h-5 w-5 flex-none" style={{ color: toneStyle.color }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-ink-950">{location.title}</span>
            <span className="mt-px block text-xs text-ink-500">{location.text}</span>
          </span>
          {!clockedIn && loc.kind !== 'unchecked' && (
            <button type="button" onClick={recheck} disabled={loc.kind === 'checking'} aria-label="Check my location again" title="Check again"
              className="flex h-8 flex-none items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-600 hover:bg-surface disabled:opacity-50">
              {loc.kind === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Check
            </button>
          )}
        </div>
      )}

      {/* Clock-out scan: the camera reads the office QR, then the usual clock-out (task first if missing). */}
      {scanOut && (
        <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setScanOut(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[16px] font-bold text-ink-950">Scan the office QR to clock out</p>
              <button type="button" onClick={() => setScanOut(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <QrScanner onScan={onScanOut} onError={(e) => { setScanOut(false); setShowCode(true); notifyError({ message: e }, 'Camera unavailable') }} />
          </div>
        </div>
      )}

      {/* Proof-of-presence selfie before clocking in. */}
      {selfieOpen && (
        <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => !timeIn.isPending && setSelfieOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SelfieCapture onCapture={(blob) => timeIn.mutate(blob)} onSkip={() => timeIn.mutate(undefined)} busy={timeIn.isPending} required={selfieRequired} />
          </div>
        </div>
      )}

      {/* The Task Description is asked for at clock-out, then the clock-out goes through. */}
      {narrativeOpen && openLogId && (
        <NarrativeModal logId={openLogId} clockingOut={timeOut.isPending} onClose={() => setNarrativeOpen(false)}
          onSubmitted={() => {
            setNarrativeOpen(false)
            invalidate()
            timeOut.mutate(undefined)
          }} />
      )}
    </div>
  )
}
