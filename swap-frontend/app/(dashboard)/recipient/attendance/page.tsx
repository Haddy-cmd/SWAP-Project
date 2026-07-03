'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, CheckCircle, AlertTriangle, FileText, MapPin } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getCurrentPosition, getBestPosition, distanceMeters, type Coords } from '@/lib/utils/geolocation'

type AttendanceMode = 'idle' | 'clocked-in'

const GRACE_MS = 5 * 60 * 1000 // auto clock-out after 5 min outside the geofence
const POLL_MS = 15_000

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const [openLogId, setOpenLogId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [qrToken, setQrToken] = useState('')
  const [geoWarning, setGeoWarning] = useState<string | null>(null)
  const [narrativeOpen, setNarrativeOpen] = useState(false)
  const outsideSinceRef = useRef<number | null>(null)

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

  // Keep the clocked-in state fully in sync with the server: clear it the moment the open log is gone.
  useEffect(() => {
    setOpenLogId(currentLog?.id ?? null)
  }, [currentLog])

  const timeIn = useMutation({
    mutationFn: async () => {
      // Geofenced clock-in: attach GPS when available; backend enforces premises for geofenced offices.
      let coords: Coords | undefined
      try {
        coords = await getBestPosition()
      } catch {
        coords = undefined
      }
      return attendanceApi.timeInGeofence(qrToken, coords)
    },
    onSuccess: (res) => {
      setOpenLogId(res.data.id)
      const premises = res.data.location_flagged
        ? ' Your location couldn’t be fully verified (weak GPS).'
        : ' You’re inside the office premises.'
      setMessage({ type: 'success', text: `Time-in recorded at ${formatDateTime(res.data.time_in)}.${premises}` })
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
      setQrToken('')
    },
    onError: (err: { message?: string }) => {
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
      setMessage({ type: 'success', text: `Time-out recorded at ${formatDateTime(res.data.time_out!)}` })
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
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
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Attendance</h1>
        <p className="mt-1 text-sm text-[#64748B]">Scan or paste your office QR code to clock in or out. Location access must be enabled — you must be on the office premises to clock in.</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        {/* Status row: badge on the left, live timer chip on the right */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
              mode === 'clocked-in' ? 'bg-green-50 text-[#27AE60]' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${mode === 'clocked-in' ? 'animate-pulse bg-[#27AE60]' : 'bg-[#94A3B8]'}`} />
            {mode === 'clocked-in' ? 'Currently Clocked In' : 'Not Clocked In'}
          </div>

          {mode === 'clocked-in' && currentLog?.time_in && (
            <LiveTimerChip timeIn={currentLog.time_in} state={geoWarning ? 'away' : 'live'} />
          )}
        </div>

        {/* Currently-at-office banner while geofence monitoring is active */}
        {mode === 'clocked-in' && office && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-sm font-medium text-[#1B4F72]">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            Currently at {office.name}
            {currentLog?.time_in && <span className="text-xs font-normal text-[#64748B]">· since {formatDateTime(currentLog.time_in)}</span>}
            {monitoring && <span className="text-xs font-normal text-[#64748B]">· location monitored</span>}
          </div>
        )}

        {geoWarning && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-[#92400E]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {geoWarning}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">QR Token</label>
            <input
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Paste or scan your office QR token"
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm font-mono text-[#1E293B] placeholder-[#94A3B8] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/20"
            />
          </div>

          {mode === 'clocked-in' && (
            <p className="flex items-center gap-2 text-xs text-[#64748B]">
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              {currentLog?.has_narrative
                ? 'Narrative report submitted — ready to clock out.'
                : 'You will be asked for a short narrative report when you clock out.'}
            </p>
          )}

          {mode === 'idle' && completed && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-[#27AE60]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              You have completed all your required service hours. No further clock-ins are needed.
            </div>
          )}

          <div className="flex gap-3">
            {mode === 'idle' ? (
              <button
                onClick={() => timeIn.mutate()}
                disabled={timeIn.isPending || !qrToken.trim() || completed}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#27AE60] px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                {timeIn.isPending ? 'Verifying location…' : 'Clock In'}
              </button>
            ) : (
              <button
                onClick={handleClockOut}
                disabled={timeOut.isPending || !qrToken.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E74C3C] px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {timeOut.isPending ? 'Recording…' : 'Clock Out'}
              </button>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Hours Summary</h2>
          <HoursProgress summary={summary} />
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
