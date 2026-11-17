'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, LogIn, LogOut, Loader2, AlertTriangle, Building2 } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { clockLabel, shiftSeconds } from '@/lib/utils/shift'
import type { TimeLog } from '@/types/attendance.types'

export type ClockChoice =
  | { action: 'in'; selfieRequired: boolean }
  | { action: 'out'; log: TimeLog }

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/**
 * The pop-out after the office QR is scanned: it reads the recipient's shift fresh from the
 * server and offers only the action that fits — Clock in when they aren't clocked in, Clock out
 * when they are (the other button is greyed out with the reason). Nothing happens until they
 * pick; the server refuses the wrong action anyway (AttendanceService).
 */
export function ClockConfirmSheet({ onChoose, onCancel }: {
  onChoose: (choice: ClockChoice) => void
  onCancel: () => void
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [log, setLog] = useState<TimeLog | null>(null)
  const [office, setOffice] = useState<string | null>(null)
  const [selfieRequired, setSelfieRequired] = useState(true)
  // Why clock-in is closed right now (from the server, null for a System Testing account).
  const [closed, setClosed] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [current, assignment] = await Promise.all([
        attendanceApi.getCurrentLog(),
        attendanceApi.getMyAssignment().catch(() => null),
      ])
      setLog(current ?? null)
      setOffice(current?.office?.name ?? assignment?.office?.name ?? null)
      // Default to the selfie until the assignment says otherwise (the server enforces it too).
      setSelfieRequired(assignment?.selfie_required ?? true)
      setClosed(assignment?.clock_in_closed ?? null)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!log) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [log])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const clockedIn = !!log
  const ready = state === 'ready'

  return (
    <div className="sheet-overlay fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="clock-confirm-title"
        className="phone-sheet w-full max-w-sm rounded-t-2xl bg-surface p-5 pb-safe shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-success-50">
            <CheckCircle2 className="h-5 w-5 text-success-600" />
          </span>
          <div className="min-w-0">
            <h2 id="clock-confirm-title" className="text-[15px] font-bold text-ink-900">Office QR scanned</h2>
            {office && <p className="flex items-center gap-1 truncate text-xs text-ink-500"><Building2 className="h-3.5 w-3.5 flex-none" /> {office}</p>}
          </div>
        </div>

        {/* Where they stand right now, read fresh from the server. */}
        <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-sm" aria-live="polite">
          {state === 'loading' && <p className="flex items-center gap-2 text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking your shift…</p>}
          {state === 'error' && (
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-danger-700"><AlertTriangle className="h-4 w-4 flex-none" /> Couldn&apos;t check your shift.</p>
              <button onClick={() => void load()} className="text-xs font-semibold text-accent hover:underline">Try again</button>
            </div>
          )}
          {ready && (clockedIn ? (
            <p className="text-ink-700">
              Clocked in since <b>{timeOf(log!.time_in)}</b> · <span className="tabular-nums">{clockLabel(shiftSeconds(log!, now))}</span>
              {log!.left_premises_at && <span className="ml-1 font-semibold text-gold-700">· Paused · away</span>}
            </p>
          ) : closed ? (
            // Off hours: said before any location is asked for.
            <p className="flex items-start gap-2 font-medium text-warning-800"><Clock className="mt-0.5 h-4 w-4 flex-none" /> {closed}</p>
          ) : (
            <p className="text-ink-700">You&apos;re not clocked in.</p>
          ))}
        </div>

        {/* Only the action that fits is active. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div>
            <button
              onClick={() => onChoose({ action: 'in', selfieRequired })}
              disabled={!ready || clockedIn || !!closed}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
            >
              {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Clock in
            </button>
            {ready && clockedIn && <p className="mt-1 text-center text-[11.5px] text-ink-400">You&apos;re already clocked in.</p>}
            {ready && !clockedIn && closed && <p className="mt-1 text-center text-[11.5px] text-ink-400">Closed right now.</p>}
          </div>
          <div>
            <button
              onClick={() => log && onChoose({ action: 'out', log })}
              disabled={!ready || !clockedIn}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger-600 text-sm font-semibold text-white transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
            >
              {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock out
            </button>
            {ready && !clockedIn && <p className="mt-1 text-center text-[11.5px] text-ink-400">You&apos;re not clocked in yet.</p>}
          </div>
        </div>

        <button onClick={onCancel} className="mt-3 h-10 w-full rounded-xl text-sm font-semibold text-ink-600 hover:bg-ink-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
