'use client'

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'

/** Live HH:MM:SS chip counting up from a clock-in timestamp; ticks every second. */
export function LiveTimerChip({ timeIn, state = 'live' }: { timeIn: string; state?: 'live' | 'away' }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const secs = Math.max(0, Math.floor((now - new Date(timeIn).getTime()) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const label = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`

  const away = state === 'away'

  return (
    <div
      title={`Clocked in at ${formatDateTime(timeIn)}`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
        away ? 'border-warning-200 bg-warning-50' : 'border-success-100 bg-success-50'
      }`}
    >
      <Timer className={`h-4 w-4 ${away ? 'text-warning-600' : 'text-success-600'}`} />
      <span className={`font-mono text-sm font-bold tabular-nums ${away ? 'text-warning-800' : 'text-success-800'}`}>{label}</span>
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${away ? 'text-warning-600' : 'text-success-600'}`}>
        {away ? 'away' : 'live'}
      </span>
    </div>
  )
}
