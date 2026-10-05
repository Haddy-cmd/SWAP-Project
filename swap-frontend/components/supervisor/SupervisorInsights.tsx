'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Hourglass, Timer, UserX, LogOut } from 'lucide-react'
import { supervisorApi } from '@/lib/api/supervisor.api'
import { formatDate } from '@/lib/utils/formatDate'

const CARD = 'rounded-2xl border border-ink-200 bg-white p-5 shadow-sm'

function Tile({ icon, label, value, sub, warn }: { icon: ReactNode; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-[12px] border border-ink-200 bg-ink-50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{icon}{label}</div>
      <div className={`mt-1 font-serif text-[22px] font-semibold leading-none tabular-nums ${warn ? 'text-warning-700' : 'text-ink-950'}`}>{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-500">{sub}</div>}
    </div>
  )
}

/** Supervisor → Reports, above the roster: the verification queue, their own pace, who stopped coming. */
export function SupervisorInsights() {
  const { data } = useQuery({ queryKey: ['supervisor-insights'], queryFn: () => supervisorApi.getInsights() })
  if (!data) return null

  return (
    <div className="no-print space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Waiting to verify" value={String(data.pending)}
          sub={`${data.pending_hours} h`} warn={data.pending > 0} />
        <Tile icon={<Hourglass className="h-3.5 w-3.5" />} label="Oldest waiting"
          value={data.oldest_pending_days == null ? '—' : `${data.oldest_pending_days} d`} warn={(data.oldest_pending_days ?? 0) >= 3} />
        <Tile icon={<Timer className="h-3.5 w-3.5" />} label="Your verify time"
          value={data.my_avg_verify_hours == null ? '—' : `${data.my_avg_verify_hours} h`}
          sub={`Average over ${data.my_verified_30d} log${data.my_verified_30d === 1 ? '' : 's'} in 30 days`} />
        <Tile icon={<Timer className="h-3.5 w-3.5" />} label="Avg session"
          value={data.avg_session_hours == null ? '—' : `${data.avg_session_hours} h`} sub={`${data.students} student${data.students === 1 ? '' : 's'}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <UserX className="h-4 w-4 text-warning-600" /> No clock-in for {data.inactive_after_days}+ days
          </p>
          {data.inactive.length === 0 ? (
            <p className="text-[12.5px] text-ink-500">Everyone has clocked in within the last {data.inactive_after_days} days.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.inactive.map((s) => (
                <li key={s.student_id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <Link href={`/supervisor/students/${s.student_id}`} className="font-semibold text-brand-700 hover:underline">{s.name}</Link>
                  <span className="text-ink-500">{s.last_clock_in ? `Last on ${formatDate(s.last_clock_in)} · ${s.days} days ago` : 'Never clocked in'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <LogOut className="h-4 w-4 text-ink-500" /> Automatic clock-outs this term
          </p>
          {data.auto_clock_outs.length === 0 ? (
            <p className="text-[12.5px] text-ink-500">No one was clocked out automatically (left the premises or the 12-hour limit).</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.auto_clock_outs.map((s) => (
                <li key={s.student_id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <Link href={`/supervisor/students/${s.student_id}/logs`} className="font-semibold text-brand-700 hover:underline">{s.name}</Link>
                  <span className="font-bold tabular-nums text-ink-900">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
