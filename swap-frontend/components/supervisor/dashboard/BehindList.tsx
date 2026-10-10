'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Loader2, TrendingDown } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { CARD, firstName, hrs, idOf, nameOf, type StudentRow } from './shared'

export const BEHIND_HREF = '/supervisor/students?group=behind'

/** Students whose verified hours trail the elapsed term, most behind first, with a reminder bell. */
export function BehindList({ students }: { students: StudentRow[] }) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [sent, setSent] = useState<Record<number, true>>({})

  const remind = useMutation({
    mutationFn: (s: StudentRow) => attendanceApi.remindPace(idOf(s)),
    onSuccess: (_r, s) => {
      setSent((m) => ({ ...m, [idOf(s)]: true }))
      notify({ title: `Reminder sent to ${firstName(nameOf(s))}`, detail: 'They get a notification and an email.' })
      qc.invalidateQueries({ queryKey: ['supervisor-students'] })
    },
    onError: (e) => notifyError(e, 'Could not send the reminder'),
  })

  return (
    <section className={`${CARD} flex min-h-0 flex-col overflow-hidden`}>
      <div className="flex-none border-b border-ink-900/[.06] px-4 pb-2.5 pt-3.5">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-[19px] w-[19px] text-warning-700" />
          <span className="flex-1 text-[14px] font-bold text-ink-950">Falling behind</span>
          <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11.5px] font-bold text-warning-700">{students.length}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-500">Most behind first · there&apos;s still time to help</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5">
        {students.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-ink-500">No one is falling behind.</p>
        ) : students.map((s) => {
          const id = idOf(s)
          const pct = Math.min(100, s.pace?.percent ?? 0)
          const done = !!sent[id] || !!s.pace_reminded_today
          const busy = remind.isPending && remind.variables && idOf(remind.variables) === id
          const gap = s.pace?.deficit_hours
          return (
            <div key={id} className="flex items-center gap-2.5 rounded-[10px] p-2 hover:bg-warning-50/60">
              <Link href={`/supervisor/students/${id}`} className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink-900">{nameOf(s)}</span>
                  <span className="flex-none text-[12px] font-bold text-warning-700">{pct}%</span>
                </div>
                <div className="mt-[5px] h-[5px] rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-warning-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-ink-500">
                  {hrs(s.verified_hours)} of {hrs(s.required_hours)}{gap ? ` · ${hrs(gap)} behind` : ' · behind schedule'}
                </div>
              </Link>
              <button type="button" onClick={() => !done && remind.mutate(s)} disabled={done || !!busy}
                title={done ? 'Reminded today' : 'Send a reminder'} aria-label={done ? `${nameOf(s)} was reminded today` : `Remind ${nameOf(s)}`}
                className={`tap flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] border transition-colors ${
                  done ? 'border-accent/30 bg-accent-tint text-accent-strong' : 'border-ink-200 bg-surface text-ink-600 hover:border-warning-600 hover:text-warning-700'}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </button>
            </div>
          )
        })}
      </div>

      {students.length > 0 && (
        <Link href={BEHIND_HREF} className="flex-none border-t border-ink-900/[.06] px-4 py-2.5 text-[12.5px] font-semibold text-accent hover:text-accent-hover">
          See all {students.length} →
        </Link>
      )}
    </section>
  )
}
