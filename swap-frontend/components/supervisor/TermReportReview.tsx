'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { TermReportBody } from '@/components/attendance/TermReportCard'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import type { TermReport } from '@/types/attendance.types'

/**
 * The end-of-term narrative report with the supervisor's acceptance: Eligible / Not
 * eligible for renewal plus remarks (TermReportReviewService). A student who completed
 * their hours needs it accepted as eligible to renew; one short on hours renews on the
 * approved promissory note and the submitted report.
 */
export function TermReportReview({ assignmentId, report, hoursMet }: {
  assignmentId: number
  report: TermReport | null
  hoursMet: boolean
}) {
  const qc = useQueryClient()
  const [eligible, setEligible] = useState<boolean | null>(report?.renewal_eligible ?? null)
  const [remarks, setRemarks] = useState(report?.review_remarks ?? '')
  const [editing, setEditing] = useState(!report?.reviewed_at)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    setEligible(report?.renewal_eligible ?? null)
    setRemarks(report?.review_remarks ?? '')
    setEditing(!report?.reviewed_at)
  }, [report?.reviewed_at, report?.renewal_eligible, report?.review_remarks])

  const save = useMutation({
    mutationFn: () => attendanceApi.reviewTermReport(assignmentId, { renewal_eligible: eligible!, remarks: remarks.trim() || null }),
    onSuccess: (res) => {
      setSaved(res.message)
      qc.invalidateQueries({ queryKey: ['student-summary'] })
      qc.invalidateQueries({ queryKey: ['supervisor-students'] })
      qc.invalidateQueries({ queryKey: ['term-report'] })
      qc.invalidateQueries({ queryKey: ['student-logs'] })
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not accept the report.'),
  })

  if (!report?.submitted_at) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        Not submitted yet. The student writes it on their Hours page; the stipend can&apos;t be released and the renewal can&apos;t be approved without it.
      </p>
    )
  }

  return (
    <div>
      <TermReportBody report={report} />

      <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4">
        {!hoursMet && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Short on hours: the approved promissory note and this report are enough for renewal. Accept it only if you want to record a mark;
            &ldquo;Not eligible&rdquo; still blocks the renewal.
          </p>
        )}
        {report.reviewed_at && !editing ? (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                report.renewal_eligible ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>
                Accepted · {report.renewal_eligible ? 'Eligible for renewal' : 'Not eligible for renewal'}
              </span>
              {report.review_remarks && <p className="mt-2 text-sm italic text-ink-600">&ldquo;{report.review_remarks}&rdquo;</p>}
              <p className="mt-1 text-[11.5px] text-ink-400">{formatDateTime(report.reviewed_at)}{report.reviewer ? ` · ${report.reviewer}` : ''}</p>
            </div>
            <button onClick={() => { setSaved(null); setEditing(true) }}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-ink-50">Change</button>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-ink-700">Accept the report and mark the student</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Renewal">
              {([[true, 'Eligible for renewal'], [false, 'Not eligible for renewal']] as const).map(([value, label]) => (
                <button key={label} role="radio" aria-checked={eligible === value}
                  onClick={() => { setEligible(value); setError(null); setSaved(null) }}
                  className={cn('rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    eligible === value
                      ? value ? 'border-success-600 bg-success-50 text-success-800' : 'border-danger-600 bg-danger-50 text-danger-700'
                      : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-ink-700">Remarks <span className="font-normal text-ink-400">(optional)</span></span>
              <textarea value={remarks} onChange={(e) => { setRemarks(e.target.value); setError(null); setSaved(null) }} rows={2} maxLength={2000}
                placeholder="Anything the student or the DSA should know"
                className="mt-1 w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
            </label>
            {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {report.reviewed_at && (
                <button onClick={() => setEditing(false)} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-white">Cancel</button>
              )}
              <button onClick={() => save.mutate()} disabled={eligible === null || save.isPending}
                className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Accept report'}
              </button>
            </div>
          </>
        )}
        {saved && <p className="mt-2 text-sm font-medium text-success-700">{saved}</p>}
      </div>
    </div>
  )
}

/** My Students → menu → End-term report: the report and its acceptance in a popup. */
export function TermReportReviewModal({ studentId, studentName, onClose }: { studentId: number; studentName: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['student-summary', String(studentId)],
    queryFn: () => attendanceApi.getStudentSummary(studentId),
  })
  const term = [data?.student?.semester, data?.student?.academic_year].filter(Boolean).join(' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-700" />
            <div>
              <h2 className="font-semibold text-ink-900">End-of-term report</h2>
              <p className="text-xs text-ink-500">{studentName}{term ? ` · ${term}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-350 hover:text-danger-600"><X className="h-5 w-5" /></button>
        </div>
        {isLoading || !data ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-ink-100" />
        ) : data.assignment_id ? (
          <TermReportReview assignmentId={data.assignment_id} report={data.term_report ?? null} hoursMet={data.hours_met ?? true} />
        ) : (
          <p className="mt-3 text-sm text-ink-500">This student has no current placement.</p>
        )}
      </div>
    </div>
  )
}
