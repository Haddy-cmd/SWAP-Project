// Hand-mirrored from TestingService::status (Admin → System Testing).
import type { TermBadgeValue } from './assignment.types'

export interface TestingAssignment {
  id: number
  term: string
  status: 'active' | 'completed' | 'suspended'
  required_hours: number
  verified_hours: number
  end_date: string | null
  term_badge: TermBadgeValue
  evaluation: number | null
  report_submitted: boolean
  /** The term's promissory note, if any. */
  promissory: 'approved' | 'pending' | null
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
  /** Shortcut changes recorded (undone on "Remove from testing"). */
  changes: number
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

// Same text as TestTools::MSG_OFF.
export const TESTING_OFF_MESSAGE = 'Switch System Testing on first.'

export type TestingAction =
  | 'hours' | 'complete-hours' | 'reset-hours' | 'clock-in' | 'auto-clock-out'
  | 'end-term' | 'file-promissory' | 'close-term' | 'makeup-overdue'
  | 'term-report' | 'evaluation' | 'renewal' | 'reset-term'
