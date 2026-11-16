/** Mirrors App\Support\RejectionReasons (labels and messages verbatim). */
export const REJECTION_REASONS = {
  incomplete_documents: 'Incomplete or invalid documents',
  grade_requirement: 'Grade requirement not met',
  no_slots: 'No available slots this semester',
  missed_interview: 'Did not attend the interview',
  other: 'Other',
} as const

export type RejectionReason = keyof typeof REJECTION_REASONS

export const REJECTION_NOTE_MIN = 10
export const MSG_REASON_REQUIRED = 'Choose a reason for not approving this application.'
export const MSG_NOTE_REQUIRED = 'Explain the reason in at least 10 characters.'
/** ReopenApplicationRequest::MSG_REASON */
export const MSG_REOPEN_REASON = 'Explain why this application is being reopened (at least 10 characters).'

/** What still blocks rejecting, or null when the reason (and note, for "Other") is enough. */
export function rejectionProblem(reason: string, note: string): string | null {
  if (!reason) return MSG_REASON_REQUIRED
  if (reason === 'other' && note.trim().length < REJECTION_NOTE_MIN) return MSG_NOTE_REQUIRED
  return null
}
