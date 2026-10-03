'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, CheckCircle2, Lock } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import type { TermReport } from '@/types/attendance.types'

const MIN_CHARS = 100
const TEXTAREA =
  'w-full rounded-xl border border-ink-300 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20'

/**
 * The recipient's end-of-term narrative report (Hours page). One per term, editable
 * until the supervisor accepts it or the stipend is released; the release is refused
 * without it. Once accepted it shows the supervisor's renewal mark.
 */
export function TermReportCard() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['term-report'], queryFn: attendanceApi.getTermReport })
  const report = data?.data ?? null
  const meta = data?.meta

  const [form, setForm] = useState({ content: '', accomplishments: '', challenges: '' })
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (report) setForm({ content: report.content, accomplishments: report.accomplishments ?? '', challenges: report.challenges ?? '' })
  }, [report])

  const save = useMutation({
    mutationFn: () => attendanceApi.saveTermReport({
      content: form.content.trim(),
      accomplishments: form.accomplishments.trim() || null,
      challenges: form.challenges.trim() || null,
    }),
    onSuccess: (res) => {
      qc.setQueryData(['term-report'], { data: res.data, meta })
      setEditing(false); setError(null); setSaved(res.message ?? 'Saved.')
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not save your report.'),
  })

  if (isLoading || !meta?.has_assignment) return null

  const showForm = meta.editable && (!report || editing)
  const chars = form.content.trim().length

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">End-of-Term Report</h2>
            {report?.reviewed_at ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                report.renewal_eligible ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                <CheckCircle2 className="h-3 w-3" /> Accepted · {report.renewal_eligible ? 'Eligible for renewal' : 'Not eligible for renewal'}
              </span>
            ) : report ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                <CheckCircle2 className="h-3 w-3" /> Submitted · waiting for your supervisor
              </span>
            ) : (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">Required for your stipend</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            One narrative report for {[meta.semester, meta.academic_year].filter(Boolean).join(', ') || 'this term'}: what you did, what you accomplished, what was hard.
            Your supervisor accepts it and marks whether you are eligible for renewal; your stipend cannot be released until it is submitted.
          </p>
        </div>
        {report && meta.editable && !editing && (
          <button onClick={() => { setSaved(null); setEditing(true) }}
            className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-ink-50">Edit</button>
        )}
      </div>

      {showForm ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Narrative of your service this term</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} maxLength={5000}
              placeholder="Describe your duties and how your service went over the term…" className={TEXTAREA} />
            <p className={`mt-1 text-xs ${chars >= MIN_CHARS ? 'text-ink-350' : 'text-warning-700'}`}>
              {chars < MIN_CHARS ? `At least ${MIN_CHARS} characters (${chars} so far).` : `${chars} characters.`}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Accomplishments <span className="font-normal text-ink-350">(optional)</span></label>
            <textarea value={form.accomplishments} onChange={(e) => setForm({ ...form, accomplishments: e.target.value })} rows={3} maxLength={3000} className={TEXTAREA} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Challenges <span className="font-normal text-ink-350">(optional)</span></label>
            <textarea value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} rows={3} maxLength={3000} className={TEXTAREA} />
          </div>
          {error && <p className="text-sm text-danger-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setError(null); save.mutate() }} disabled={save.isPending || chars < MIN_CHARS}
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {save.isPending ? 'Saving…' : report ? 'Save changes' : 'Submit report'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setError(null) }}
                className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
            )}
          </div>
        </div>
      ) : report ? (
        <TermReportBody report={report} />
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-500"><Lock className="h-4 w-4" /> Your stipend for this term has already been released.</p>
      )}

      {report?.reviewed_at && (
        <div className="mt-3 rounded-xl bg-ink-50 px-4 py-3 text-sm">
          <p className="text-ink-700">
            Accepted by {report.reviewer ?? 'your supervisor'} on {formatDateTime(report.reviewed_at)} ·{' '}
            <b className={report.renewal_eligible ? 'text-success-700' : 'text-danger-700'}>
              {report.renewal_eligible ? 'eligible for renewal' : 'not eligible for renewal'}
            </b>
          </p>
          {report.review_remarks && <p className="mt-1 italic text-ink-600">&ldquo;{report.review_remarks}&rdquo;</p>}
        </div>
      )}
      {!meta.editable && report && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-350"><Lock className="h-3.5 w-3.5" />
          {report.reviewed_at ? ' Locked: your supervisor accepted it.' : ' Locked: your stipend for this term has been released.'}</p>
      )}
      {saved && <p className="mt-3 text-xs font-medium text-success-700">{saved}</p>}
    </div>
  )
}

/** Read-only view of a submitted report (the supervisor's student page, and the recipient after saving). */
export function TermReportBody({ report }: { report: TermReport }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="whitespace-pre-line text-ink-900">{report.content}</p>
      {report.accomplishments && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Accomplishments</p>
          <p className="mt-0.5 whitespace-pre-line text-ink-700">{report.accomplishments}</p>
        </div>
      )}
      {report.challenges && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Challenges</p>
          <p className="mt-0.5 whitespace-pre-line text-ink-700">{report.challenges}</p>
        </div>
      )}
      {report.submitted_at && (
        <p className="text-xs text-ink-350">
          Submitted {formatDateTime(report.submitted_at)}
          {report.updated_at && report.updated_at !== report.submitted_at && <> · last edited {formatDateTime(report.updated_at)}</>}
        </p>
      )}
    </div>
  )
}
