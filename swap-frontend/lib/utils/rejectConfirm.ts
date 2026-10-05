import type { ConfirmInput } from '@/components/feedback/FeedbackProvider'
import type { Application, RenewalReadiness } from '@/types/application.types'
import { formatDate } from '@/lib/utils/formatDate'

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

/**
 * What rejecting a renewal costs the recipient right now (ApplicationService::returnToApplicant
 * switches them to the applicant portal at once): a term still running, a stub not claimed,
 * a stipend not released, a missing end-of-term report.
 */
export function renewalRejectWarnings(readiness: RenewalReadiness | null | undefined): string[] {
  if (!readiness) return []
  const term = readiness.term
  const warnings: string[] = []
  if (readiness.term_end_date && readiness.term_end_date >= manilaToday()) {
    warnings.push(`Their ${term} term is still running (ends ${formatDate(readiness.term_end_date)}) — they won't be able to clock in for the rest of it.`)
  }
  if (readiness.stipend_status === 'certified' || readiness.stipend_status === 'pending') {
    warnings.push(`Their ${term} claim stub is released but not claimed yet — they won't be able to open it in the portal.`)
  } else if (!readiness.stipend_status && (readiness.payment === 'owed' || readiness.payment === 'promissory')) {
    warnings.push(`Their ${term} stipend hasn't been released yet.`)
  }
  if (!readiness.report.submitted) {
    warnings.push(`They haven't submitted the ${term} end-of-term report, and won't be able to after this.`)
  }
  return warnings
}

/** The "Are you sure?" before rejecting an application or a renewal (a decision is final). */
export function rejectConfirm(application: Application | null | undefined): ConfirmInput {
  const name = application?.user?.name ?? 'This applicant'
  return application?.type === 'renewal'
    ? {
        title: 'Reject this renewal?',
        body: `${name} will be moved back to the applicant portal right away. They lose clock-in, hours, end-of-term report and stipend pages, and their current placement is closed. They can apply again as a new applicant while the application period is open.`,
        details: renewalRejectWarnings(application.renewal_readiness),
        confirmLabel: 'Yes, reject renewal',
        tone: 'danger',
      }
    : {
        title: 'Reject this application?',
        body: `${name} is notified with your remarks. A decided application can't be reopened.`,
        confirmLabel: 'Reject',
        tone: 'danger',
      }
}
