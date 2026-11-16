'use client'

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'
import { clockLabel, shiftSeconds } from '@/lib/utils/shift'

/** Live HH:MM:SS chip counting up from a clock-in timestamp; ticks every second. */
export function LiveTimerChip({ timeIn, state = 'live', leftAt = null, awaySeconds = 0 }: {
  timeIn: string; state?: 'live' | 'away'
  /** The open shift's absence from the office: the count pauses while away, earlier absences don't count. */
  leftAt?: string | null; awaySeconds?: number
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const label = clockLabel(shiftSeconds({ time_in: timeIn, left_premises_at: leftAt, away_seconds: awaySeconds }, now))

  const away = state === 'away' || !!leftAt

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
