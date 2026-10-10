// Hand-mirrored from TestingService::status (Admin → System Testing).
import type { TermBadgeValue } from './assignment.types'

export interface TestingAssignment {
  id: number
  term: string
  status: 'active' | 'completed' | 'suspended'
  required_hours: number
  verified_hours: number
  /** Hours logged and waiting for the supervisor. */
  pending_hours: number
  end_date: string | null
  term_badge: TermBadgeValue
  /** The supervisor's acceptance of the report: null until accepted, then eligible or not. */
  report_eligible: boolean | null
  report_submitted: boolean
  /** The term's promissory note, if any. */
  promissory: 'approved' | 'pending' | null
  /** The term's stipend stub: released (final); claimed/certified/pending are legacy rows. */
  stipend: 'pending' | 'certified' | 'claimed' | 'released' | null
}

export interface TestingApplication {
  id: number
  term: string
  type: 'new' | 'renewal'
  status: string
}

/** An existing account the admin picked for System Testing. */
export interface TestingAccount {
  id: number
  role: 'recipient' | 'applicant'
  name: string
  email: string
  student_id_number: string | null
  /** When it was picked: Restore (or switching testing off) puts it back to this moment (ISO). */
  picked_at: string
  /** False only for an account picked before restore points existed (cleaned up instead). */
  restorable: boolean
  /** Its email switch: true = bell notifications only, no emails (the default when picked). */
  email_muted: boolean
  /** When their open shift started (ISO), or null when not clocked in. */
  clocked_in_since: string | null
  assignments: TestingAssignment[]
  applications: TestingApplication[]
}

export interface TestingStatus {
  /** The page's On/Off switch: picking, bypasses and shortcuts work only while on. */
  enabled: boolean
  accounts: TestingAccount[]
}

/** An existing recipient/applicant the admin can pick (TestingService::candidates). */
export interface TestingCandidate {
  id: number
  name: string
  email: string
  role: 'recipient' | 'applicant'
  student_id_number: string | null
  term: string | null
}

/** An account tested before restore points existed, with what its cleanup would do (TestingService::earlierTests). */
export interface EarlierTest {
  id: number
  name: string
  email: string
  student_id_number: string | null
  /** Still picked from before restore points existed. */
  picked: boolean
  /** The test windows, e.g. "Oct 2, 2026 3:24 PM – Oct 2, 2026 4:10 PM". */
  tested: string[]
  /** What the cleanup removes or puts back. */
  items: string[]
}

// Same text as TestTools::MSG_OFF.
export const TESTING_OFF_MESSAGE = 'Switch System Testing on first.'

export type TestingAction =
  | 'hours' | 'complete-hours' | 'reset-hours' | 'verify-hours' | 'clock-in' | 'auto-clock-out'
  | 'end-term' | 'file-promissory' | 'approve-promissory' | 'reject-promissory' | 'close-term'
  | 'term-report' | 'review-report' | 'renewal' | 'reset-term' | 'release-stub' | 'reset-stipend'

/** Admin → System Testing → File storage (StorageCheckService::run). */
export interface StorageCheck {
  disk: { name: string; driver: string | null; durable: boolean; warning: string | null }
  /** Write → read → delete of a small file; `step` and `error` say what failed. */
  probe: { ok: boolean; step: 'write' | 'read' | 'delete' | null; error: string | null }
  /** Signature/photo links are built from APP_URL; a warning means they point elsewhere. */
  links: { app_url: string; request_host: string; warning: string | null }
  /** Accounts whose signature or photo is on record but not in storage (at most 300 files checked). */
  missing: {
    checked: number
    total: number
    unchecked: number
    files: { user_id: number; name: string; email: string; role: string; file: 'signature' | 'photo' }[]
  }
}
