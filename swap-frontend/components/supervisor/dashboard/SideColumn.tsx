'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Moon, Search } from 'lucide-react'
import { LiveTimerChip } from '@/components/attendance/LiveTimerChip'
import type { TimeLog } from '@/types/attendance.types'
import { CARD, Initials, idOf, nameOf, officeOf, type StudentRow } from './shared'

/** Right column: who is clocked in right now, and a searchable list of my students. */
export function SideColumn({ onDuty, students }: { onDuty: TimeLog[]; students: StudentRow[] }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? students.filter((s) => nameOf(s).toLowerCase().includes(needle) || officeOf(s).toLowerCase().includes(needle))
    : students

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className={`${CARD} flex-none px-4 py-3.5`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${onDuty.length ? 'animate-live bg-success-600' : 'bg-ink-300'}`} />
          <span className="flex-1 text-[14px] font-bold text-ink-950">On duty now</span>
          <span className="text-[12px] font-bold text-ink-600">{onDuty.length}</span>
        </div>
        {onDuty.length === 0 ? (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-500">
            <Moon className="h-5 w-5 text-ink-350" /> No one is clocked in right now.
          </div>
        ) : (
          <div className="mt-2 max-h-[180px] space-y-1 overflow-auto">
            {onDuty.map((log) => (
              <Link key={log.id} href={`/supervisor/students/${log.user_id}/logs`}
                className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 hover:bg-ink-50">
                <Initials name={log.user?.name ?? '?'} avatarUrl={(log.user as { avatar_url?: string | null })?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{log.user?.name ?? 'Recipient'}</div>
                  <div className="truncate text-[11.5px] text-ink-500">
                    {log.office?.name ?? '—'}
                    {log.location_flagged && <span className="font-medium text-warning-700"> · location unverified</span>}
                  </div>
                </div>
                {log.time_in && <LiveTimerChip timeIn={log.time_in} leftAt={log.left_premises_at} awaySeconds={log.away_seconds ?? 0} />}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="flex-none px-4 pb-2.5 pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-ink-950">My students</span>
            <Link href="/supervisor/students" className="text-[12px] font-semibold text-accent hover:text-accent-hover">All {students.length} →</Link>
          </div>
          <label className="mt-2.5 flex h-[38px] items-center gap-2 rounded-[10px] bg-ink-50 px-3">
            <Search className="h-[18px] w-[18px] text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-900 placeholder-ink-400 focus:outline-none" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {students.length === 0 ? (
            <p className="p-5 text-center text-[12.5px] text-ink-500">No students assigned yet.</p>
          ) : shown.length === 0 ? (
            <p className="p-5 text-center text-[12.5px] text-ink-500">No match.</p>
          ) : shown.map((s) => (
            <Link key={idOf(s)} href={`/supervisor/students/${idOf(s)}`}
              className="flex items-center gap-2.5 rounded-[10px] px-2 py-[7px] hover:bg-ink-50">
              <Initials name={nameOf(s)} avatarUrl={s.user?.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink-900">{nameOf(s)}</div>
                <div className="truncate text-[11.5px] text-ink-500">{officeOf(s)}</div>
              </div>
              <ChevronRight className="h-[18px] w-[18px] text-ink-350" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
