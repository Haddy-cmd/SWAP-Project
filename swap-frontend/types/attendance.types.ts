export type TimeLogStatus = 'open' | 'pending_verification' | 'verified' | 'rejected'

export interface TimeLog {
  id: number
  assignment_id: number
  user_id: number
  date: string
  time_in: string
  time_out: string | null
  duration_hours: number | null
  status: TimeLogStatus
  verified_by: number | null
  verified_at: string | null
  rejection_reason: string | null
  has_narrative: boolean
  created_at: string
  narrative_report?: NarrativeReport | null
  verifications?: Verification[]
}

export interface HoursSummary {
  required: number
  rendered: number
  verified: number
  pending: number
  rejected: number
  remaining: number
}

export interface NarrativeReport {
  id: number
  time_log_id: number
  content: string
  activities_done: string
  challenges: string | null
  submitted_at: string
  created_at: string
}

export interface Verification {
  id: number
  action: 'verified' | 'rejected'
  feedback: string | null
  verified_by: number
  created_at: string
}

export interface StoreNarrativeData {
  content: string
  activities_done: string
  challenges?: string
}

export interface VerifyLogData {
  action: 'verified' | 'rejected'
  feedback?: string
}
