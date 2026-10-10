'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCheck, Loader2, X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { blocksBulkVerify, reviewReason } from '@/lib/utils/attendanceReview'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { RejectLogDialog } from '@/components/supervisor/RejectLogDialog'
import type { TimeLog } from '@/types/attendance.types'
import { CARD, fmtHrs } from './HoursCard'

const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '…'

/** The term's newest logs, with verify / reject right here for the waiting ones. */
export function RecentLogs({ studentId, studentName }: { studentId: number; studentName: string }) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [rejecting, setRejecting] = useState<TimeLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['student-logs', String(studentId), 'recent'],
    queryFn: () => attendanceApi.getStudentLogs(studentId, { per_page: '8' }),
  })
  const logs = data?.data ?? []
  const waiting = logs.filter((l) => l.status === 'pending_verification')
  const clean = waiting.filter((l) => !blocksBulkVerify(l))
  const flagged = waiting.length - clean.length

  const refresh = () => {
    for (const key of ['student-logs', 'student-summary', 'supervisor-students', 'supervisor-pending-logs', 'verifications']) qc.invalidateQueries({ queryKey: [key] })
  }
  const verify = useMutation({
    mutationFn: (l: TimeLog) => attendanceApi.verifyLog(l.id, { action: 'verified', feedback: '' }),
    onSuccess: (_r, l) => { notify({ title: `${fmtHrs(Number(l.duration_hours) || 0)}h verified` }); refresh() },
    onError: (e) => notifyError(e, 'Could not verify the hours'),
  })
  const verifyAll = useMutation({
    mutationFn: () => attendanceApi.verifyLogsBulk(clean.map((l) => l.id)),
    onSuccess: (r) => {
      notify({ title: `${r.meta?.verified ?? clean.length} ${clean.length === 1 ? 'log' : 'logs'} verified`, detail: flagged ? `${flagged} flagged ${flagged === 1 ? 'log needs' : 'logs need'} a closer look.` : null })
      refresh()
    },
    onError: (e) => notifyError(e, 'Could not verify the logs'),
  })

  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-900/[.06] px-5 py-3.5">
        <span className="flex-1 text-[15px] font-bold text-ink-950">Time logs</span>
        {clean.length > 0 && (
          <button type="button" onClick={() => verifyAll.mutate()} disabled={verifyAll.isPending}
            className="flex h-[34px] items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60">
            {verifyAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Verify {clean.length} waiting
          </button>
        )}
        <Link href={`/supervisor/students/${studentId}/logs`} className="text-[12.5px] font-semibold text-accent hover:text-accent-hover">All logs →</Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-ink-100" />)}</div>
      ) : logs.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-ink-500">No time logs this term yet.</p>
      ) : logs.map((l) => {
        const d = new Date(`${l.date.slice(0, 10)}T00:00:00`)
        const isWaiting = l.status === 'pending_verification'
        const flag = reviewReason(l)
        const sub = l.status === 'rejected' && l.rejection_reason ? { text: l.rejection_reason, red: true }
          : flag && isWaiting ? { text: flag, red: true }
            : l.status === 'open' ? { text: 'On the clock now', red: false }
              : isWaiting ? { text: 'Waiting for you', red: false }
                : { text: l.office?.name ?? '', red: false }
        const busy = verify.isPending && verify.variables?.id === l.id
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-3.5 border-b border-ink-900/[.05] px-5 py-[11px] last:border-0">
            <div className="w-10 flex-none text-center leading-tight">
              <div className="text-[10.5px] font-bold uppercase text-ink-500">{d.toLocaleDateString('en-PH', { month: 'short' })}</div>
              <div className="text-[18px] font-extrabold text-ink-950">{d.getDate()}</div>
            </div>
            <div className="min-w-[150px] flex-1">
              <div className="text-[13px] font-semibold text-ink-900">
                {l.is_manual ? `Bonus · ${l.manual_reason ?? 'added by a supervisor'}` : `${time(l.time_in)} – ${l.time_out ? time(l.time_out) : 'now'}`}
              </div>
              <div className={`text-[11.5px] first-letter:uppercase ${sub.red ? 'text-danger-700' : 'text-ink-500'}`}>{sub.text}</div>
            </div>
            <strong className="min-w-[30px] text-right text-[13.5px] text-ink-950">{l.duration_hours != null ? `${fmtHrs(Number(l.duration_hours))}h` : '—'}</strong>
            {isWaiting ? (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setRejecting(l)} title="Reject" aria-label="Reject"
                  className="tap flex h-8 w-8 items-center justify-center rounded-[9px] border border-danger-200 bg-surface text-danger-700 hover:bg-danger-50">
                  <X className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => verify.mutate(l)} disabled={busy} title="Verify" aria-label="Verify"
                  className="tap flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-white hover:bg-accent-hover disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <span className="min-w-[70px] text-right">
                {l.status === 'verified' && <span className="rounded-full bg-accent-soft px-2.5 py-[3px] text-[11.5px] font-bold text-accent-strong">Verified</span>}
                {l.status === 'rejected' && <span className="rounded-full bg-danger-50 px-2.5 py-[3px] text-[11.5px] font-bold text-danger-700">Rejected</span>}
                {l.status === 'open' && <span className="rounded-full bg-info-100 px-2.5 py-[3px] text-[11.5px] font-bold text-info-700">Open</span>}
              </span>
            )}
          </div>
        )
      })}

      {rejecting && <RejectLogDialog log={rejecting} studentName={studentName} onClose={() => setRejecting(null)} />}
    </section>
  )
}
