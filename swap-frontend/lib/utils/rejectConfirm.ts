import type { ConfirmInput } from '@/components/feedback/FeedbackProvider'
import type { Application, RenewalReadiness } from '@/types/application.types'
import { formatDate } from '@/lib/utils/formatDate'

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

/**
 * What rejecting a renewal costs the recipient right now (ApplicationService::returnToApplicant
 * switches them to a deactivated applicant account at once): a term still running, a stipend not
 * released, a missing end-of-term report. A released stipend is final and unaffected.
 */
export function renewalRejectWarnings(readiness: RenewalReadiness | null | undefined): string[] {
  if (!readiness) return []
  const term = readiness.term
  const warnings: string[] = []
  if (readiness.term_end_date && readiness.term_end_date >= manilaToday()) {
    warnings.push(`Their ${term} term is still running (ends ${formatDate(readiness.term_end_date)}) — they won't be able to clock in for the rest of it.`)
  }
  if (!readiness.stipend_status && (readiness.payment === 'owed' || readiness.payment === 'promissory')) {
    warnings.push(`Their ${term} stipend hasn't been released yet.`)
  }
  if (!readiness.report.submitted) {
    warnings.push(`They haven't submitted the ${term} end-of-term report, and won't be able to after this.`)
  }
  if (!readiness.stipend_status && (readiness.payment === 'owed' || readiness.payment === 'promissory') && readiness.report.submitted) {
    // Release itself still works for a deactivated account; they just can't sign in to check.
    warnings.push('You can still release that stipend after rejecting.')
  }
  return warnings
}

/**
 * The supervisor marked the renewed term "not eligible for renewal": approval stays locked
 * (RenewalReadinessService), and the admin rejects instead. These are the remarks the
 * review form starts with (sent to the student; the admin can edit them).
 */
export function notEligibleRemarks(readiness: RenewalReadiness | null | undefined): string | null {
  if (!readiness || readiness.report.renewal_eligible !== false) return null
  return `Your supervisor marked you not eligible for renewal for ${readiness.term}.`
}

/** The "Are you sure?" before rejecting an application or a renewal (a decision is final). */
export function rejectConfirm(application: Application | null | undefined): ConfirmInput {
  const name = application?.user?.name ?? 'This applicant'
  return application?.type === 'renewal'
    ? {
        title: 'Reject this renewal?',
        body: `${name} goes back to an applicant account right away: they're signed out, their current placement is closed, and their next sign-in opens the applicant dashboard. They can apply again as a new applicant next semester. Their last claim stub is emailed to them.`,
        details: renewalRejectWarnings(application.renewal_readiness),
        confirmLabel: 'Yes, reject renewal',
        tone: 'danger',
      }
    : {
        title: 'Reject this application?',
        body: `${name} is notified with the reason. They can apply again next semester. If this was a mistake, you can reopen it during this semester.`,
        confirmLabel: 'Reject',
        tone: 'danger',
      }
}
