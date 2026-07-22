'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LogIn, LogOut, CheckCircle2, AlertTriangle, FileText, MapPin, MapPinOff,
  QrCode, ScanLine, Clock, Hourglass, Moon, X, Timer,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import { SelfieCapture } from '@/components/attendance/SelfieCapture'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getCurrentPosition, getBestPosition, distanceMeters, type Coords } from '@/lib/utils/geolocation'
import type { TimeLog } from '@/types/attendance.types'

type AttendanceMode = 'idle' | 'clocked-in'

const GRACE_MS = 10 * 60 * 1000 // auto clock-out after 10 min outside the geofence
const POLL_MS = 15_000

const pad = (n: number) => String(n).padStart(2, '0')
const fmtHrs = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))
const fmtDur = (hours: number) => {
  const mins = Math.round((Number(hours) || 0) * 60)
  const h = Math.floor(mins / 60), m = mins % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
const fmtClock = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
/** Local YYYY-MM-DD, so "today" matches the user's wall calendar. */
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const SESSION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  verified: { label: 'Verified', color: '#2C5A33', bg: '#EAF5EC' },
  pending_verification: { label: 'Pending', color: '#9A6B12', bg: '#FBF3E2' },
  rejected: { label: 'Rejected', color: '#B0562F', bg: '#FDF0E9' },
  open: { label: 'In progress', color: '#1F5C86', bg: '#EAF1F7' },
}

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const [openLogId, setOpenLogId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [qrToken, setQrToken] = useState('')
  const [geoWarning, setGeoWarning] = useState<string | null>(null)
  const [narrativeOpen, setNarrativeOpen] = useState(false)
  const [selfieOpen, setSelfieOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const outsideSinceRef = useRef<number | null>(null)

  // Live wall clock + session timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Successes auto-dismiss; errors stay until replaced or closed.
  useEffect(() => {
    if (message?.type !== 'success') return
    const id = setTimeout(() => setMessage(null), 4500)
    return () => clearTimeout(id)
  }, [message])

  const { data: summary } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

  // Restore clock-in state from the server so an open log survives reloads / re-login.
  // Poll while an open log exists so a clock-out (auto, or from another tab/device) is noticed.
  const { data: currentLog } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: (query) => (query.state.data ? 20_000 : false),
  })

  const { data: logsPage } = useQuery({
    queryKey: ['my-logs', 'today'],
    queryFn: () => attendanceApi.getMyLogs({ per_page: '50' }),
  })

  // Keep the clocked-in state fully in sync with the server: clear it the moment the open log is gone.
  useEffect(() => {
    setOpenLogId(currentLog?.id ?? null)
  }, [currentLog])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
    queryClient.invalidateQueries({ queryKey: ['my-logs'] })
  }

  const timeIn = useMutation({
    mutationFn: async (photo?: Blob) => {
      // Geofenced clock-in: attach GPS when available; backend enforces premises for geofenced offices.
      let coords: Coords | undefined
      try {
        coords = await getBestPosition()
      } catch {
        coords = undefined
      }
      return attendanceApi.timeInGeofence(qrToken, coords, photo)
    },
    onSuccess: (res) => {
      setOpenLogId(res.data.id)
      setSelfieOpen(false)
      const premises = res.data.location_flagged
        ? ' Your location couldn’t be fully verified (weak GPS).'
        : ' You’re inside the office premises.'
      setMessage({ type: 'success', text: `Time-in recorded at ${formatDateTime(res.data.time_in)}.${premises}` })
      invalidate()
      setQrToken('')
    },
    onError: (err: { message?: string }) => {
      setSelfieOpen(false)
      setMessage({ type: 'error', text: err.message ?? 'Time-in failed. Please try again.' })
    },
  })

  const timeOut = useMutation({
    mutationFn: async () => {
      if (!openLogId) throw new Error('No open log')
      let coords: Coords | undefined
      try {
        coords = await getBestPosition()
      } catch {
        coords = undefined
      }
      return attendanceApi.timeOut(openLogId, qrToken, coords)
    },
    onSuccess: (res) => {
      setOpenLogId(null)
      setGeoWarning(null)
      outsideSinceRef.current = null
      setMessage({ type: 'success', text: `Session logged — pending verification (out at ${formatDateTime(res.data.time_out!)})` })
      invalidate()
      setQrToken('')
    },
    onError: (err: { message?: string }) => {
      setMessage({ type: 'error', text: err.message ?? 'Time-out failed.' })
    },
  })

  const autoClockOut = useMutation({
    mutationFn: (coords?: { latitude: number; longitude: number; accuracy?: number }) => {
      if (!openLogId) throw new Error('No open log')
      return attendanceApi.autoClockOut(openLogId, coords)
    },
    onSuccess: () => {
      setOpenLogId(null)
      setGeoWarning(null)
      outsideSinceRef.current = null
      setMessage({ type: 'error', text: 'You left the office premises and were automatically clocked out.' })
      invalidate()
    },
  })

  // Clock out: if a narrative is already in, go straight out; otherwise pop the narrative form first.
  const handleClockOut = () => {
    if (currentLog?.has_narrative) {
      timeOut.mutate()
    } else {
      setNarrativeOpen(true)
    }
  }

  const mode: AttendanceMode = openLogId ? 'clocked-in' : 'idle'
  const completed = !!summary && summary.required > 0 && summary.remaining <= 0
  const office = currentLog?.office ?? null
  const monitoring = mode === 'clocked-in' && !!office?.geofence_enabled && office.latitude != null && office.longitude != null

  // Background geofence monitoring → auto clock-out after the grace period.
  // Held in a ref and refreshed every render so the polling interval (below) can be set up
  // ONCE per monitoring session instead of being torn down on every 1-second timer re-render.
  const checkLocationRef = useRef<() => void>(() => {})
  checkLocationRef.current = async () => {
    if (!office || office.latitude == null || office.longitude == null) return
    try {
      const pos = await getCurrentPosition()
      const dist = distanceMeters(pos.latitude, pos.longitude, Number(office.latitude), Number(office.longitude))
      // Allow the GPS uncertainty (capped) as tolerance, matching the server-side geofence check.
      const inside = dist <= (office.radius_meters ?? 100) + Math.min(pos.accuracy ?? 0, 100)
      if (inside) {
        outsideSinceRef.current = null
        setGeoWarning(null)
        return
      }
      if (outsideSinceRef.current == null) outsideSinceRef.current = Date.now()
      const elapsed = Date.now() - outsideSinceRef.current
      if (elapsed >= GRACE_MS) {
        autoClockOut.mutate({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy })
      } else {
        const mins = Math.ceil((GRACE_MS - elapsed) / 60_000)
        setGeoWarning(`You appear to have left ${office.name}. You'll be clocked out automatically in ~${mins} min if you don't return.`)
      }
    } catch {
      // Ignore transient GPS errors; keep prior state.
    }
  }

  useEffect(() => {
    if (!monitoring) return
    checkLocationRef.current()
    const id = setInterval(() => checkLocationRef.current(), POLL_MS)
    return () => clearInterval(id)
  }, [monitoring])

  // ── derived display values ──────────────────────────────────────────────────
  const elapsed = (() => {
    if (mode !== 'clocked-in' || !currentLog?.time_in) return '00:00:00'
    const s = Math.max(0, Math.floor((now - new Date(currentLog.time_in).getTime()) / 1000))
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  })()

  const required = summary?.required ?? 200
  const verified = summary?.verified ?? 0
  const pending = summary?.pending ?? 0
  const remaining = summary?.remaining ?? Math.max(0, required - verified)
  const pct = required > 0 ? Math.min(100, (verified / required) * 100) : 0

  const todaySessions = useMemo(() => {
    const today = localToday()
    return (logsPage?.data ?? []).filter((l: TimeLog) => l.date === today)
  }, [logsPage])
  const todayHours = todaySessions.reduce((s, l) => s + (Number(l.duration_hours) || 0), 0)

  const canClock = qrToken.trim().length > 0 && !completed

  // Location banner state (all modes)
  const geo = geoWarning
    ? { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', Icon: AlertTriangle, title: 'You appear to have left the premises', sub: geoWarning }
    : mode === 'clocked-in' && office
      ? { bg: '#EAF5EC', border: '#CDE7D2', color: '#2C5A33', Icon: MapPin, title: `Location verified — ${office.name}`, sub: monitoring ? "You're on premises · location is monitored" : "You're on premises" }
      : { bg: '#FBF7F2', border: '#EFE5DA', color: '#7A6A63', Icon: MapPinOff, title: 'Location required', sub: 'Enable location access — you must be on the office premises to clock in.' }

  return (
    <div className="mx-auto max-w-[940px] space-y-4">
      {/* header */}
      <div className="mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Time &amp; Attendance</p>
        <h1 className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[#241715]">Attendance</h1>
        <p className="mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-[#7A6A63]">
          Scan or paste your office QR code to clock in or out. Location must be enabled — you have to be on the office premises for it to count.
        </p>
      </div>

      {/* main grid */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_0.9fr]">
        {/* ── CLOCK CARD ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-[#EFE5DA] bg-white shadow-[0_2px_8px_rgba(60,30,25,.05)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#F4ECE1] bg-[#FBF7F2] px-5 py-4">
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
              style={mode === 'clocked-in' ? { color: '#2C5A33', background: '#EAF5EC' } : { color: '#8A7A73', background: '#F1E7DC' }}>
              <span className={`h-2 w-2 rounded-full ${mode === 'clocked-in' ? 'animate-pulse' : ''}`}
                style={{ background: mode === 'clocked-in' ? '#4E9657' : '#B7A99F' }} />
              {mode === 'clocked-in' ? 'Clocked In' : 'Not Clocked In'}
            </span>
            <div className="text-right leading-tight">
              <div className="text-[12px] text-[#A38A82]">
                {new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="font-serif text-[16px] font-semibold tabular-nums text-[#3F2F2A]">
                {new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            {mode === 'clocked-in' && (
              <div className="mb-5 pt-1.5 text-center">
                <div className="mb-2 text-[11.5px] font-semibold text-[#8A7A73]">Elapsed this session</div>
                <div className="font-serif text-[56px] font-semibold leading-none tabular-nums text-[#241715]">{elapsed}</div>
                <div className="mt-2.5 text-[13px] text-[#8A7A73]">
                  Clocked in at <strong className="font-bold text-[#3F2F2A]">{fmtClock(currentLog?.time_in)}</strong>
                </div>
              </div>
            )}

            {/* The office QR token is required to clock out as well as in. */}
            <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-[#8A7A73]">
              Office QR Token
            </label>
            <div className="mb-3.5 flex gap-2.5">
              <div className="relative flex-1">
                <QrCode className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#B79B7E]" />
                <input
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  placeholder={mode === 'clocked-in' ? 'Paste your office QR token to clock out' : 'Paste your office QR token'}
                  className="h-12 w-full rounded-xl border border-[#EADFD4] bg-[#FBF7F2] pl-11 pr-3.5 text-sm text-[#241715] placeholder-[#B7A99F] focus:border-[#7C1B26] focus:outline-none"
                />
              </div>
              <Link href="/recipient/attendance/scan"
                className="flex h-12 flex-none items-center gap-1.5 rounded-xl border border-[#EADFD4] bg-white px-4 text-[13px] font-bold text-[#7C1B26] hover:bg-[#FBF7F2] transition-colors">
                <ScanLine className="h-[19px] w-[19px]" /> Scan
              </Link>
            </div>

            {/* location banner (both states) */}
            <div className="mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
              style={{ background: geo.bg, border: `1px solid ${geo.border}` }}>
              <geo.Icon className="h-[19px] w-[19px] flex-none" style={{ color: geo.color }} />
              <div className="min-w-0 flex-1 leading-snug">
                <div className="text-[12.5px] font-bold" style={{ color: geo.color }}>{geo.title}</div>
                <div className="text-[11.5px] text-[#8A7A73]">{geo.sub}</div>
              </div>
            </div>

            {mode === 'clocked-in' && (
              <p className="mb-3.5 flex items-center gap-2 text-xs text-[#8A7A73]">
                <FileText className="h-3.5 w-3.5 flex-none" />
                {currentLog?.has_narrative
                  ? 'Narrative report submitted — ready to clock out.'
                  : 'You will be asked for a short narrative report when you clock out.'}
              </p>
            )}

            {mode === 'idle' && completed && (
              <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-[#CDE7D2] bg-[#EAF5EC] px-4 py-3 text-sm font-medium text-[#2C5A33]">
                <CheckCircle2 className="h-4 w-4 flex-none" />
                You have completed all your required service hours. No further clock-ins are needed.
              </div>
            )}

            {/* action button */}
            {mode === 'clocked-in' ? (
              <button onClick={handleClockOut} disabled={timeOut.isPending || !qrToken.trim()}
                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[13px] text-[15px] font-bold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,.26)] disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
                <LogOut className="h-5 w-5" /> {timeOut.isPending ? 'Recording…' : 'Clock Out'}
              </button>
            ) : (
              <button onClick={() => setSelfieOpen(true)} disabled={timeIn.isPending || !canClock}
                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[13px] text-[15px] font-bold text-[#FFF8F2] transition-opacity disabled:cursor-not-allowed"
                style={canClock
                  ? { background: 'linear-gradient(180deg,#86202E,#6C1620)', boxShadow: '0 12px 24px rgba(108,22,32,.26)' }
                  : { background: '#C9B0A6' }}>
                <LogIn className="h-5 w-5" />
                {timeIn.isPending ? 'Verifying location…' : completed ? 'Requirement complete' : canClock ? 'Clock In' : 'Enter QR token to clock in'}
              </button>
            )}
          </div>
        </div>

        {/* ── PROGRESS CARD ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#EFE5DA] bg-white px-[22px] pb-5 pt-[22px] shadow-[0_2px_8px_rgba(60,30,25,.05)]">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#A38A82]">Service Hours</div>

          <div className="mb-1.5 flex justify-center">
            <div className="relative h-[158px] w-[158px] rounded-full"
              style={{ background: `conic-gradient(#7C1B26 0 ${pct}%, #F1E7DC ${pct}% 100%)` }}>
              <div className="absolute inset-[15px] flex flex-col items-center justify-center rounded-full bg-white">
                <span className="font-serif text-[34px] font-semibold leading-none tabular-nums text-[#241715]">{fmtHrs(verified)}h</span>
                <span className="mt-1 text-[11.5px] text-[#8A7A73]">of {required}h</span>
              </div>
            </div>
          </div>
          <div className="mb-[18px] text-center text-[13px] font-bold text-[#7C1B26]">{Math.round(pct)}% complete</div>

          <div className="flex flex-col gap-2.5 border-t border-[#F4ECE1] pt-4">
            {([
              ['Verified', verified, '#4E9657', '#2C5A33'],
              ['Pending verification', pending, '#D8A12B', '#9A6B12'],
              ['Remaining', remaining, '#CBBBA9', '#5A4A45'],
            ] as const).map(([label, val, dot, color]) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: dot }} />
                <span className="flex-1 text-[13px] text-[#5A4A45]">{label}</span>
                <span className="text-[13.5px] font-bold tabular-nums" style={{ color }}>{fmtHrs(val)}h</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[#A89A8F]">
            Pending hours count toward your total once your supervisor verifies them.
          </p>
        </div>
      </div>

      {/* ── TODAY'S SESSIONS ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#EFE5DA] bg-white shadow-[0_2px_8px_rgba(60,30,25,.05)]">
        <div className="flex items-center justify-between border-b border-[#F4ECE1] px-5 py-4">
          <span className="font-serif text-[17px] font-semibold text-[#241715]">Today&apos;s sessions</span>
          <span className="rounded-full bg-[#FBEAEC] px-3 py-1 text-[12px] font-bold tabular-nums text-[#7C1B26]">
            {fmtDur(todayHours)} today
          </span>
        </div>

        {todaySessions.length === 0 ? (
          <div className="px-5 py-11 text-center">
            <Moon className="mx-auto h-9 w-9 text-[#C9B7AC]" />
            <div className="mt-2.5 text-[14.5px] font-semibold text-[#3F2F2A]">No sessions logged today</div>
            <div className="mt-1 text-[13px] text-[#A38A82]">Clock in with your office QR token to start recording hours.</div>
          </div>
        ) : (
          todaySessions.map((s) => {
            const meta = SESSION_STATUS[s.status] ?? SESSION_STATUS.pending_verification
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3.5 border-b border-[#F4ECE1] px-5 py-3.5 last:border-0">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#FBF3E2] text-[#9A6B12]">
                  <Clock className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tabular-nums text-[#241715]">
                    {fmtClock(s.time_in)}{s.time_out ? ` – ${fmtClock(s.time_out)}` : ' – in progress'}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#A38A82]">Logged this session</div>
                </div>
                <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-[#EFE5DA] bg-[#FBF7F2] px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#7C1B26]">
                  <Timer className="h-[15px] w-[15px] text-[#B79B7E]" /> {fmtDur(Number(s.duration_hours) || 0)}
                </span>
                <span className="inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold"
                  style={{ color: meta.color, background: meta.bg }}>
                  <Hourglass className="h-3.5 w-3.5" /> {meta.label}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* toast */}
      {message && (
        <div className="fixed right-7 top-[78px] z-[70] flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] font-semibold shadow-[0_16px_36px_rgba(20,50,25,.25)]"
          style={message.type === 'success'
            ? { background: '#2C5A33', color: '#F0FAF0' }
            : { background: '#8A2230', color: '#FDECEC' }}>
          {message.type === 'success'
            ? <CheckCircle2 className="mt-px h-[18px] w-[18px] flex-none" />
            : <AlertTriangle className="mt-px h-[18px] w-[18px] flex-none" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Proof-of-presence selfie before clocking in. */}
      {selfieOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => !timeIn.isPending && setSelfieOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SelfieCapture
              onCapture={(blob) => timeIn.mutate(blob)}
              onSkip={() => timeIn.mutate(undefined)}
              busy={timeIn.isPending}
            />
          </div>
        </div>
      )}

      {/* Narrative pops up at clock-out time, then proceeds to clock out. */}
      {narrativeOpen && openLogId && (
        <NarrativeModal
          logId={openLogId}
          clockingOut={timeOut.isPending}
          onClose={() => setNarrativeOpen(false)}
          onSubmitted={() => {
            setNarrativeOpen(false)
            queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
            timeOut.mutate()
          }}
        />
      )}
    </div>
  )
}
