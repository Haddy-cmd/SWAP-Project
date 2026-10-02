export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'

export interface Application {
  id: number
  user_id: number
  academic_year: string
  semester: string
  status: ApplicationStatus
  type?: 'new' | 'renewal'
  renewal_context?: {
    office: string | null
    supervisor: string | null
    supervisor_employee_id?: string | null
    period: string
    verified_hours: number
    required_hours: number
    status: string
  } | null
  // Admins only: what approving the renewal still needs (RenewalReadinessService).
  renewal_readiness?: RenewalReadiness | null
  remarks: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  documents?: ApplicationDocument[]
  interview?: Interview | null
  user?: import('./auth.types').User
}

export interface ApplicationDocument {
  id: number
  application_id: number
  document_type: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
}

export interface Interview {
  id: number
  application_id: number
  scheduled_at: string
  location: string | null
  meeting_link?: string | null
  duration_minutes?: number
  mode: 'in_person' | 'online'
  notes: string | null
  status: string
  history?: {
    from: string | null
    to: string | null
    changed_at: string
    changed_by: string | null
  }[]
}

export interface ScheduleInterviewData {
  scheduled_at: string
  location?: string
  meeting_link?: string
  duration_minutes?: number
  mode: 'in_person' | 'online'
  notes?: string
}

export interface DecideApplicationData {
  decision: 'approved' | 'rejected'
  remarks?: string
}

/** Hand-mirrored from RenewalReadinessService::check. */
export interface RenewalReadiness {
  term: string
  // The renewal carries the recipient's updated COR.
  cor_attached: boolean
  // Unfinished promissory makeup hours that approval adds to the next term.
  carry_hours: number
  term_status: 'qualified' | 'deficient' | null
  deficient_hours: number | null
  payment: 'paid' | 'not_required' | 'owed' | 'promissory' | 'unpaid'
  promissory_note_id: number | null
  makeup_deadline: string | null
  makeup_overdue: boolean
  report_submitted: boolean
  evaluation: TermEvaluation | null
  passing_rating: number
  ready: boolean
  // The first unmet requirement — the approval is refused with this message.
  blocker: string | null
}

/** Hand-mirrored from TermEvaluation::toPayload. */
export interface TermEvaluation {
  rating: number
  rating_label: string | null
  remarks: string
  passed: boolean
  evaluator: string | null
  updated_at: string | null
}
