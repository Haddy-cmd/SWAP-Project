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
  /** Who verified or rejected it — offices may have several supervisors sharing a roster. */
  verifier?: { id: number; name: string; avatar_url?: string | null } | null
  rejection_reason: string | null
  clocked_out_reason?: 'manual' | 'auto' | 'auto_stale' | null
  location_flagged?: boolean
  location_flag_reason?: string | null
  time_in_photo_url?: string | null
  is_manual?: boolean
  manual_reason?: string | null
  time_in_accuracy?: number | string | null
  time_out_accuracy?: number | string | null
  has_narrative: boolean
  /** The term this log belongs to (from its assignment) — used to group the duty slip by semester. */
  academic_year?: string | null
  semester?: string | null
  created_at: string
  narrative_report?: NarrativeReport | null
  verifications?: Verification[]
  office?: TimeLogOffice | null
  user?: { id: number; name: string; avatar_url?: string | null }
}

export interface TimeLogOffice {
  id: number
  name: string
  latitude: number | string | null
  longitude: number | string | null
  radius_meters: number | null
  geofence_enabled: boolean
  // Off → no geofence watch; the student clocks out by scanning the QR.
  auto_clock_out?: boolean
}

// Mirrors TermReportService::toArray — the end-of-term narrative report.
export interface TermReport {
  id: number
  assignment_id: number
  content: string
  accomplishments: string | null
  challenges: string | null
  submitted_at: string | null
  updated_at: string | null
  /** The supervisor's acceptance (null until accepted) and renewal mark. */
  reviewed_at: string | null
  reviewer: string | null
  renewal_eligible: boolean | null
  review_remarks: string | null
}

export interface TermReportMeta {
  has_assignment: boolean
  editable: boolean
  academic_year: string | null
  semester: string | null
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
  /** The Task Description: required to clock out, printed on the duty slip. */
  content: string
  activities_done: string | null
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
  /** Task Description (required, 10+ characters). */
  content: string
  activities_done?: string | null
  challenges?: string | null
}

export interface VerifyLogData {
  action: 'verified' | 'rejected'
  feedback?: string
}

/** Recipient → pace, forecast, hours breakdown and checklist (RecipientProgressService::forUser). */
export interface RecipientProgress {
  term: string
  end_date: string | null
  /** Same rule supervisors see (Assignment::paceStatus). */
  pace: { status: 'on_track' | 'behind' | 'complete' | 'not_started'; percent: number; expected_hours: number | null; deficit_hours: number | null }
  forecast: {
    /** Required − verified − pending (pending usually gets verified). */
    outstanding_hours: number
    weeks_left: number | null
    hours_per_week_needed: number | null
    /** Hours rendered over the last 28 days, per week. */
    recent_weekly_average: number
    projected_finish: string | null
    on_time: boolean | null
  }
  breakdown: {
    verified_hours: number
    pending_hours: number
    rejected_hours: number
    bonus_hours: number
    days_on_duty: number
    avg_session_hours: number | null
    rejected_logs: { id: number; date: string; hours: number; reason: string | null }[]
  }
  /** What the stipend and the renewal still need, in the order the system checks them. */
  checklist: { key: 'hours' | 'signature' | 'report' | 'stipend'; state: 'done' | 'todo' | 'waiting' | 'blocked'; label: string; link: string | null }[]
}
