'use client'

import Link from 'next/link'
import { XCircle, ArrowRight } from 'lucide-react'
import type { Application } from '@/types/application.types'
import type { ApplicationStatus as PeriodStatus } from '@/lib/api/settings.api'

/** A rejected new application is for the term applications are taken for right now. */
export function rejectedForCurrentTerm(app: Application | undefined, period: PeriodStatus | undefined): boolean {
  if (!app || app.status !== 'rejected' || app.type === 'renewal' || !period?.term) return false
  return app.academic_year === period.term.academic_year && app.semester === period.term.semester
}

/**
 * What a rejected applicant needs to know: why, when they can apply again, and what
 * happens to their files (removed once the next semester starts, PurgeRejectedDocuments).
 */
export function RejectedNotice({ application, period, showLink = false, applyBlock = null }: {
  application: Application
  period?: PeriodStatus
  /** On the dashboard: link to the application page. */
  showLink?: boolean
  /** The server's reason a new application must wait (a rejected renewal: next semester). */
  applyBlock?: string | null
}) {
  const renewal = application.type === 'renewal'
  const sameTerm = renewal ? !!applyBlock : rejectedForCurrentTerm(application, period)
  const canApplyNow = !sameTerm && period?.open === true && !!period.term
  const purged = application.documents?.some((d) => d.purged_at) ?? false
  const reason = application.rejection_reason_label

  return (
    <div className="rounded-2xl border border-danger-200 bg-danger-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-5 w-5 flex-none text-danger-700" />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-semibold text-danger-700">
            {renewal ? 'Renewal not approved' : 'Not approved'} for {application.semester} {application.academic_year}
          </p>
          {renewal && (
            <p className="text-ink-700">
              Your account is now an applicant account. Your past hours and stipend records stay on file. If your last stipend was released, its claim stub was emailed to you.
            </p>
          )}
          {(reason || application.remarks) && (
            <div className="text-ink-700">
              {reason && <p><span className="font-semibold">Reason:</span> {reason}</p>}
              {application.remarks && <p className="mt-0.5 break-words">{reason ? 'Note from the DSA: ' : 'Reason: '}{application.remarks}</p>}
            </div>
          )}
          <p className="text-ink-700">
            {canApplyNow
              ? `Applications are open for ${period!.term!.semester} ${period!.term!.academic_year}. You can apply again now${renewal ? ' as a new applicant' : ''}.`
              : `You can apply again${renewal ? ' as a new applicant' : ''} next semester, once the DSA opens applications.`}
          </p>
          <p className="text-xs text-ink-500">
            {renewal ? '' : purged
              ? 'The files you uploaded for this application were removed after the retention period.'
              : 'The files you uploaded for this application are removed when the next semester starts, so keep your own copies.'}
            {' '}Questions? Visit the DSA Office.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {canApplyNow && (
              <Link href="/applicant/application/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600">
                Apply again <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {showLink && (
              <Link href={`/applicant/application/${application.id}`} className="inline-flex items-center gap-1 rounded-lg border border-danger-200 bg-surface px-4 py-2 text-xs font-semibold text-danger-700 hover:bg-danger-50">
                View application
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
