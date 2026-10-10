'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, ClipboardList, FileText, Loader2 } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { TermReportReviewModal } from '@/components/supervisor/TermReportReview'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { TermReport } from '@/types/attendance.types'
import { CARD } from './HoursCard'

/** The end-of-term report: not in (remind), waiting for review, or accepted with the renewal mark. */
export function ReportCard({ studentId, studentName, report, remindedToday, locked }: {
  studentId: number; studentName: string; report: TermReport | null; remindedToday: boolean; locked: boolean
}) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  const remind = useMutation({
    mutationFn: () => attendanceApi.remindReport(studentId),
    onSuccess: () => {
      setSent(true)
      notify({ title: `Reminder sent to ${studentName.split(' ')[0]}`, detail: 'They get a notification and an email.' })
      qc.invalidateQueries({ queryKey: ['student-summary'] })
    },
    onError: (e) => notifyError(e, 'Could not send the reminder'),
  })

  const submitted = !!report?.submitted_at
  const reviewed = !!report?.reviewed_at
  const state = !submitted
    ? { tone: 'bg-ink-100 text-ink-500', sub: 'Not submitted yet' }
    : !reviewed
      ? { tone: 'bg-gold-50 text-warning-700', sub: `Waiting for your review · submitted ${formatDateTime(report!.submitted_at!)}` }
      : report!.renewal_eligible
        ? { tone: 'bg-accent-soft text-accent-strong', sub: 'Accepted · Eligible for renewal' }
        : { tone: 'bg-danger-50 text-danger-700', sub: 'Accepted · Not eligible for renewal' }
  const blocked = sent || remindedToday ? 'Reminded today' : locked ? 'Term closed' : null

  return (
    <section className={`${CARD} px-5 py-[18px]`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] ${state.tone}`}><ClipboardList className="h-[19px] w-[19px]" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-ink-950">End-of-term report</div>
          <div className="text-[12px] text-ink-500">{state.sub}</div>
        </div>
      </div>

      {!submitted ? (
        <>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-600">Stipend and renewal both wait on this. You&apos;ll review it here once it&apos;s in.</p>
          <button type="button" onClick={() => remind.mutate()} disabled={!!blocked || remind.isPending} title={blocked ?? 'Send a reminder'}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[12.5px] font-semibold text-ink-700 hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-200">
            {remind.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} {blocked ?? 'Remind to submit'}
          </button>
        </>
      ) : (
        <>
          {reviewed && (
            <p className="mt-2.5 text-[12px] text-ink-500">
              {report?.reviewer ? `By ${report.reviewer}` : 'Accepted'}{report?.reviewed_at ? ` · ${formatDateTime(report.reviewed_at)}` : ''}
              {report?.review_remarks ? ` — “${report.review_remarks}”` : ''}
            </p>
          )}
          <button type="button" onClick={() => setOpen(true)}
            className={`mt-3 flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-bold ${reviewed
              ? 'border border-ink-200 bg-surface text-ink-700 hover:border-accent' : 'bg-accent text-white hover:bg-accent-hover'}`}>
            <FileText className="h-4 w-4" /> {reviewed ? 'View report' : 'Read & review'}
          </button>
        </>
      )}

      {open && <TermReportReviewModal studentId={studentId} studentName={studentName} onClose={() => setOpen(false)} />}
    </section>
  )
}
