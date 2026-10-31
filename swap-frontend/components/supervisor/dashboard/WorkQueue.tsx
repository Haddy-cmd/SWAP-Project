'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CameraOff, Check, CheckCheck, CircleCheckBig, Eye, FileText, Loader2, MapPinOff, Sparkles } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { clockedOutAgo, needsReview, reviewReason } from '@/lib/utils/attendanceReview'
import { useNow } from '@/lib/hooks/useNow'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { TermReportReviewModal } from '@/components/supervisor/TermReportReview'
import { RejectLogDialog } from '@/components/supervisor/RejectLogDialog'
import type { TimeLog } from '@/types/attendance.types'
import { CARD, Initials, SectionTitle, firstName, hrs, idOf, nameOf, officeOf, type StudentRow } from './shared'

type Tab = 'logs' | 'reports'

const shortDate = (d?: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''

/** The supervisor's to-do list: logs to verify (flagged ones first) and end-of-term reports to accept. */
export function WorkQueue({ logs, reports, loading }: { logs: TimeLog[]; reports: StudentRow[]; loading: boolean }) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [tab, setTab] = useState<Tab>('logs')
  const [rejecting, setRejecting] = useState<TimeLog | null>(null)
  const [reportFor, setReportFor] = useState<{ id: number; name: string } | null>(null)
  // Ticks each minute so "Clocked out 5 min ago" counts up and drops off after 12 hours.
  const now = useNow()

  const flagged = logs.filter(needsReview)
  const normal = logs.filter((l) => !needsReview(l))
  const normalHours = normal.reduce((a, l) => a + (Number(l.duration_hours) || 0), 0)

  const refresh = () => {
    for (const key of ['supervisor-pending-logs', 'supervisor-students', 'verifications', 'student-logs', 'student-summary']) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }

  const verify = useMutation({
    mutationFn: (log: TimeLog) => attendanceApi.verifyLog(log.id, { action: 'verified', feedback: '' }),
    onSuccess: (_r, log) => { notify({ title: `${firstName(log.user?.name)}'s ${hrs(log.duration_hours)} verified` }); refresh() },
    onError: (e) => notifyError(e, 'Could not verify the hours'),
  })
  const verifyAll = useMutation({
    mutationFn: () => attendanceApi.verifyLogsBulk(normal.map((l) => l.id)),
    onSuccess: (r) => {
      const skipped = r.meta?.skipped ?? 0
      notify({
        title: `${r.meta?.verified ?? normal.length} logs verified · ${hrs(normalHours)}`,
        detail: skipped ? `${skipped} need a closer look and were left for you.` : null,
      })
      refresh()
    },
    onError: (e) => notifyError(e, 'Could not verify the logs'),
  })
  const busyId = (verify.isPending && verify.variables?.id) || null

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'logs', label: 'Logs to verify', count: logs.length },
    { id: 'reports', label: 'Reports to review', count: reports.length },
  ]

  return (
    <section className={`${CARD} flex min-h-0 flex-col overflow-hidden`}>
      <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-ink-900/[.06] px-4">
        {TABS.map((t) => {
          const on = tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`-mb-px flex h-12 flex-none items-center gap-2 border-b-[3px] px-3 text-[13.5px] ${
                on ? 'border-accent font-bold text-ink-950' : 'border-transparent font-semibold text-ink-500 hover:text-ink-800'}`}>
              {t.label}
              <span className={`rounded-full px-2 py-px text-[11.5px] font-bold ${on ? 'pill-gold' : 'bg-ink-100 text-ink-600'}`}>{t.count}</span>
            </button>
          )
        })}
        <Link href={tab === 'logs' ? '/supervisor/verifications' : '/supervisor/students'}
          className="ml-auto flex-none whitespace-nowrap pl-3 text-[12.5px] font-semibold text-accent hover:text-accent-hover">
          Open all →
        </Link>
      </div>

      {tab === 'logs' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong"><CircleCheckBig className="h-6 w-6" /></span>
              <div className="text-[14px] font-bold text-ink-950">All caught up</div>
              <div className="text-[12.5px] text-ink-500">No logs waiting for you.</div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              {flagged.length > 0 && (
                <div className="px-4 pt-3">
                  <div className="mb-1.5 text-danger-700"><SectionTitle>CHECK FIRST · {flagged.length}</SectionTitle></div>
                  {flagged.map((l) => (
                    <div key={l.id} className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-danger-200 bg-danger-50 px-2.5 py-2">
                      <Initials name={l.user?.name ?? '?'} avatarUrl={(l.user as { avatar_url?: string | null })?.avatar_url} tone="red" />
                      <div className="min-w-[180px] flex-1">
                        <Link href={`/supervisor/students/${l.user_id}/logs`} className="block truncate text-[13px] font-semibold text-ink-900 hover:text-accent">{l.user?.name ?? 'Recipient'}</Link>
                        <div className="flex items-center gap-1 truncate text-[11.5px] text-danger-700">
                          {l.location_flagged ? <MapPinOff className="h-3.5 w-3.5 flex-none" /> : <CameraOff className="h-3.5 w-3.5 flex-none" />}
                          <span className="truncate first-letter:uppercase">
                            {[reviewReason(l), clockedOutAgo(l.time_out, now), hrs(l.duration_hours), shortDate(l.date)].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-auto flex gap-1.5">
                        <button type="button" onClick={() => setRejecting(l)}
                          className="h-[30px] rounded-lg border border-danger-200 bg-surface px-2.5 text-[12px] font-semibold text-danger-700 hover:bg-danger-50">
                          Reject
                        </button>
                        <button type="button" onClick={() => verify.mutate(l)} disabled={busyId === l.id}
                          className="h-[30px] whitespace-nowrap rounded-lg border border-ink-200 bg-surface px-2.5 text-[12px] font-semibold text-accent-strong hover:border-accent disabled:opacity-60">
                          {busyId === l.id ? 'Verifying…' : 'Verify anyway'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-surface px-4 pb-2 pt-2.5">
                <div className="flex-1 text-ink-500"><SectionTitle>LOOKS NORMAL · {normal.length}</SectionTitle></div>
                {normal.length > 0 && (
                  <button type="button" onClick={() => verifyAll.mutate()} disabled={verifyAll.isPending}
                    className="flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60">
                    {verifyAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                    Verify all {normal.length} · {hrs(normalHours)}
                  </button>
                )}
              </div>
              <div className="px-2 pb-2">
                {normal.map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-[7px] hover:bg-ink-50">
                    <Initials name={l.user?.name ?? '?'} avatarUrl={(l.user as { avatar_url?: string | null })?.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-ink-900">{l.user?.name ?? 'Recipient'}</span>
                        {l.is_manual && <span className="inline-flex flex-none items-center gap-0.5 rounded-full bg-accent-soft px-1.5 text-[10.5px] font-bold text-accent-strong"><Sparkles className="h-3 w-3" />Bonus</span>}
                      </div>
                      <div className="truncate text-[11.5px] text-ink-500">{l.office?.name ?? '—'} · {shortDate(l.date)}</div>
                    </div>
                    <span className="w-10 flex-none text-right text-[13px] font-extrabold text-ink-900">{hrs(l.duration_hours)}</span>
                    <button type="button" title="Verify" aria-label={`Verify ${l.user?.name ?? 'log'}`} onClick={() => verify.mutate(l)} disabled={busyId === l.id}
                      className="tap flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-accent/30 bg-accent-tint text-accent-strong transition-colors hover:bg-accent hover:text-white disabled:opacity-60">
                      {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-[18px] w-[18px]" />}
                    </button>
                    <Link href={`/supervisor/students/${l.user_id}/logs`} title="Review" aria-label={`Review ${l.user?.name ?? 'log'}`}
                      className="tap flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-ink-200 bg-surface text-ink-600 transition-colors hover:border-accent">
                      <Eye className="h-[18px] w-[18px]" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5">
          <p className="px-1 pb-2.5 text-[12.5px] text-ink-500">Accept each report and mark if the student can renew. The DSA needs this before renewal.</p>
          {reports.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-500">All reports reviewed.</p>
          ) : reports.map((s) => (
            <div key={idOf(s)} className="mb-2 flex items-center gap-2.5 rounded-xl border border-ink-900/[.07] p-2.5">
              <Initials name={nameOf(s)} avatarUrl={s.user?.avatar_url} tone="blue" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink-900">{nameOf(s)}</div>
                <div className="truncate text-[11.5px] text-ink-500">{officeOf(s)} · end-of-term report submitted</div>
              </div>
              <button type="button" onClick={() => setReportFor({ id: idOf(s), name: nameOf(s) })}
                className="flex h-8 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12px] font-bold text-white transition-colors hover:bg-accent-hover">
                <FileText className="h-4 w-4" /> Read report
              </button>
            </div>
          ))}
        </div>
      )}

      {rejecting && <RejectLogDialog log={rejecting} onClose={() => setRejecting(null)} />}

      {reportFor && <TermReportReviewModal studentId={reportFor.id} studentName={reportFor.name} onClose={() => setReportFor(null)} />}
    </section>
  )
}
