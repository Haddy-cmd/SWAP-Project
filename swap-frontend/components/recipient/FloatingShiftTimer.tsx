'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { GripVertical } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'

const POS_KEY = 'swap-shift-timer-pos'
const DRAG_THRESHOLD = 5 // px moved before a press counts as a drag (vs a tap)
const EDGE = 8
// Default spot: top-right under the header (the chatbot sits bottom-right).
const DEFAULT_TOP = 84
const DEFAULT_RIGHT = 16

type Pos = { x: number; y: number }

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * While the recipient is clocked in: a small draggable HH:MM:SS counter on every recipient
 * page (not Attendance, which shows the big timer). A tap opens Attendance; where it was
 * dragged to is remembered in this browser (same pattern as the chatbot button).
 */
export function FloatingShiftTimer() {
  const pathname = usePathname()
  const router = useRouter()
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 })

  // Same cache as the dashboard and Attendance; refreshed so a clock-out elsewhere hides it.
  const { data: log } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
    refetchInterval: 30_000,
  })

  const running = !!log?.time_in && !log.time_out && log.status === 'open'
  // Attendance and the dashboard show the shift timer themselves.
  const hidden = !running || pathname?.startsWith('/recipient/attendance') || pathname === '/recipient/dashboard'

  const clamp = (x: number, y: number): Pos => {
    const w = ref.current?.offsetWidth ?? 190
    const h = ref.current?.offsetHeight ?? 44
    return {
      x: Math.min(Math.max(x, EDGE), window.innerWidth - w - EDGE),
      y: Math.min(Math.max(y, EDGE), window.innerHeight - h - EDGE),
    }
  }

  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  // Place it once it can be measured: the saved spot, else top-right; keep it on screen on resize.
  useEffect(() => {
    if (hidden) return
    let saved: Pos | null = null
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null')
      if (v && typeof v.x === 'number' && typeof v.y === 'number') saved = v
    } catch { /* storage blocked: use the default */ }
    const w = ref.current?.offsetWidth ?? 190
    setPos(clamp(saved?.x ?? window.innerWidth - w - DEFAULT_RIGHT, saved?.y ?? DEFAULT_TOP))
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden])

  if (hidden) return null

  const secs = Math.max(0, Math.floor((now - new Date(log!.time_in).getTime()) / 1000))
  const label = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`
  const office = log!.office?.name

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return
    drag.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, offX: e.clientX - pos.x, offY: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) d.moved = true
    if (d.moved) setPos(clamp(e.clientX - d.offX, e.clientY - d.offY))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    d.active = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (d.moved) {
      try { if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* not remembered */ }
    } else {
      router.push('/recipient/attendance') // a tap, not a drag
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      role="timer"
      aria-label={`On duty for ${label}${office ? ` at ${office}` : ''}. Open Attendance`}
      title="On duty — drag to move, tap to open Attendance"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/recipient/attendance') } }}
      style={pos ? { left: pos.x, top: pos.y } : { right: DEFAULT_RIGHT, top: DEFAULT_TOP }}
      className="fixed z-[55] flex touch-none select-none items-center gap-2 rounded-full border border-success-200 bg-white/95 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur print:hidden"
    >
      <GripVertical className="h-4 w-4 flex-none text-ink-300" aria-hidden="true" />
      <span className="relative flex h-2.5 w-2.5 flex-none" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-600" />
      </span>
      <span className="text-left leading-tight">
        <span className="block font-mono text-[15px] font-bold tabular-nums text-ink-950">{label}</span>
        <span className="block max-w-[150px] truncate text-[10.5px] font-semibold uppercase tracking-wide text-success-700">
          On duty{office ? ` · ${office}` : ''}
        </span>
      </span>
    </button>
  )
}
