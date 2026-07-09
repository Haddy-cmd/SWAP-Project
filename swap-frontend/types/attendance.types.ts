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
  clocked_out_reason?: 'manual' | 'auto' | 'auto_stale' | null
  location_flagged?: boolean
  location_flag_reason?: string | null
  time_in_photo_url?: string | null
  is_manual?: boolean
  manual_reason?: string | null
  time_in_accuracy?: number | string | null
  time_out_accuracy?: number | string | null
  has_narrative: boolean
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
