'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { getCurrentPosition, distanceMeters } from '@/lib/utils/geolocation'
import type { TimeLog } from '@/types/attendance.types'

const READ_MS = 15_000 // a GPS read
const AWAY_REPORT_MS = 60_000 // while away, the server hears at least this often (it clocks out at the deadline)

/** The open shift, shared by every recipient page (same key as the clock card and the floating timer). */
export function useCurrentShift() {
  return useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: (query) => (query.state.data ? 20_000 : false),
  })
}

/** Whether the shift's office watches the location (geofenced, auto clock-out on). */
export const isWatched = (log: TimeLog | null | undefined) =>
  !!log?.office?.geofence_enabled && log.office.auto_clock_out !== false && log.office.latitude != null && log.office.longitude != null

/**
 * While clocked in at a watched office, on every recipient page: read the GPS every 15 s and tell
 * the server when the student leaves or comes back (and every minute while away). The server keeps
 * when they left, so the countdown survives reloads; it notifies them and clocks them out.
 */
export function PremisesWatch() {
  const queryClient = useQueryClient()
  const { notify } = useFeedback()
  const { data: log } = useCurrentShift()
  const watched = isWatched(log)
  const last = useRef<{ inside: boolean | null; sentAt: number }>({ inside: null, sentAt: 0 })

  const readRef = useRef<() => void>(() => {})
  readRef.current = async () => {
    const office = log?.office
    if (!office || office.latitude == null || office.longitude == null) return
    try {
      const pos = await getCurrentPosition()
      const meters = distanceMeters(pos.latitude, pos.longitude, Number(office.latitude), Number(office.longitude))
      const inside = meters <= (office.radius_meters ?? 100) + Math.min(pos.accuracy ?? 0, 100)
      const changed = inside !== last.current.inside
      const due = !inside && Date.now() - last.current.sentAt >= AWAY_REPORT_MS
      // Inside and the server already agrees: nothing to send.
      if (!changed && !due) return
      if (changed && inside && last.current.inside === null && !log?.left_premises_at) { last.current.inside = true; return }

      last.current = { inside, sentAt: Date.now() }
      const res = await attendanceApi.reportPremises({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      if (res.clocked_out) {
        queryClient.setQueryData(['attendance-current'], null)
        for (const key of ['hours-summary', 'my-logs', 'recipient-progress']) queryClient.invalidateQueries({ queryKey: [key] })
        notify({ tone: 'info', title: 'Clocked out automatically', detail: 'You were away from the office for 10 minutes. Add your task description under Time logs.' })
      } else {
        queryClient.setQueryData(['attendance-current'], res.data)
      }
    } catch { /* GPS unavailable or a network blip: try again on the next read */ }
  }

  useEffect(() => {
    if (!watched) { last.current = { inside: null, sentAt: 0 }; return }
    readRef.current()
    const id = setInterval(() => readRef.current(), READ_MS)
    return () => clearInterval(id)
  }, [watched, log?.id])

  return null
}

/** Live remaining time until the automatic clock-out, from the server's deadline (null when not away). */
export function useAwayCountdown(log: TimeLog | null | undefined) {
  const deadline = log?.auto_clock_out_deadline ? new Date(log.auto_clock_out_deadline).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [deadline])
  if (deadline == null || !log?.left_premises_at) return null

  const left = Math.max(0, Math.ceil((deadline - now) / 1000))
  const leftAt = new Date(log.left_premises_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  return { leftAt, remaining: `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` }
}

/** "You left … return within mm:ss" — the same countdown on every page and after a reload. */
export function awayText(office: string, c: { leftAt: string; remaining: string }) {
  return `You left ${office} at ${c.leftAt}. Return within ${c.remaining} or you’ll be clocked out automatically.`
}

/** Banner over recipient pages (the clock card shows its own on Hours & Attendance). */
export function PremisesCountdown() {
  const pathname = usePathname()
  const { data: log } = useCurrentShift()
  const countdown = useAwayCountdown(log)
  if (!countdown || pathname?.startsWith('/recipient/attendance')) return null

  return (
    <Link href="/recipient/attendance" role="alert"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3.5 transition-colors hover:bg-warning-100/60">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-warning-600" />
      <span className="min-w-0 flex-1 text-sm text-warning-800">
        <strong className="block">You appear to have left the premises</strong>
        {awayText(log?.office?.name ?? 'your office', countdown)}
      </span>
      <span className="flex-none font-mono text-lg font-bold tabular-nums text-warning-800">{countdown.remaining}</span>
    </Link>
  )
}
