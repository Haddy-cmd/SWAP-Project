export interface AdminOverview {
  total_applicants: number
  total_applications: number
  approved: number
  rejected: number
  pending: number
  pending_applications: number
  active_recipients: number
  total_verified_hours: number
  pending_verifications: number
  avg_completion_rate: number
  total_offices: number
  office_distribution: OfficeDistribution[]
  office_distribution_all: OfficeDistribution[]
  monthly_stats: MonthlyStats[]
  applicants_by_college: ApplicantsByCollege[]
  recipients_by_college: RecipientsByCollege[]
  weekly_hours: WeeklyHours[]
  stipend_summary: StipendSummary
}

export interface ApplicantsByCollege {
  college: string
  applicant_count: number
  /** How the college's applications stand (pending = still in review). */
  approved?: number
  rejected?: number
  pending?: number
}

export interface RecipientsByCollege {
  college: string
  recipient_count: number
}

export interface AdminPeriod {
  academic_year: string
  semester: string
}

export interface WeeklyHours {
  week: string
  verified: number
  pending: number
}

export interface OfficeDistribution {
  office_name: string
  recipient_count: number
}

export interface MonthlyStats {
  month: string
  total_applications: number
  approved: number
  rejected: number
}

export interface StipendSummary {
  /** Released this term (a release is final; legacy Banking Office payouts included). */
  total_released: number
  /** Payable now with signature + end-of-term report in, not released yet (any term). */
  ready_to_release: number
}

/**
 * New stubs are always `released` (final). `claimed` (received at the Banking Office)
 * and `certified`/`pending` (ready to claim) are legacy rows from before 2026-10-05.
 */
export type StipendStatus = 'pending' | 'certified' | 'claimed' | 'void' | 'released'

export interface StipendSignatureView {
  /** `releasing_officer` only on legacy stubs paid at the Banking Office. */
  signatory_role: 'supervisor' | 'director' | 'beneficiary' | 'releasing_officer'
  printed_name: string
  method: 'authenticated' | 'drawn'
  signed_at: string | null
  remarks: string | null
}

export interface StipendRecord {
  id: number
  user_id: number
  amount: number
  academic_year: string
  semester: string
  period_label: string | null
  status: StipendStatus
  control_number: string | null
  certified_by: number | null
  certified_at: string | null
  released_by: number | null
  released_at: string | null
  void_reason: string | null
  has_slip: boolean
  remarks: string | null
  // Released through an approved promissory note: the term's shortfall, recorded at
  // release (printed on the stub).
  via_promissory?: boolean
  promissory_note_id?: number | null
  required_hours?: number | null
  deficient_hours?: number | null
  lacking_hours?: number | null
  created_at: string
  recipient?: import('./auth.types').User
  certifier?: { id: number; name: string } | null
  signatures?: StipendSignatureView[]
}

export interface EligibleStipend {
  user_id: number
  name: string
  student_id_number?: string | null
  academic_year: string
  semester: string
  required_hours: number
  verified_hours: number
  suggested_amount: number
  // Set for short students released via an approved promissory note.
  via_promissory: boolean
  promissory_id?: number
  // The term's shortfall the note covers (null for a normal release).
  deficient_hours?: number | null
  lacking_hours?: number | null
  // Release also needs these (StipendClaimService refuses without them).
  assignment_id?: number
  has_signature: boolean
  narrative_submitted: boolean
}

/** Admin → Analytics → Program insights for one term (ProgramInsightsService::forTerm). */
export interface ProgramInsights {
  term_results: {
    placements: number
    qualified: number
    deficient: number
    in_progress: number
    deficient_hours: number
    promissory: { filed: number; approved: number; rejected: number; pending: number }
    /** Lacking hours added to the next term's requirement on renewal. */
    carried_hours: number
  }
  renewals: {
    submitted: number
    approved: number
    rejected: number
    waiting: number
    /** Why waiting renewals can't be approved yet (the approval's own check). */
    waiting_reasons: { reason: string; count: number }[]
    previous_term: string | null
    previous_recipients: number | null
    /** Approved renewals ÷ recipients of the previous semester period, in %. */
    renewal_rate: number | null
  }
  stipend: {
    /** Live stubs this term (a release is final). */
    released: number
    released_amount: number
    via_promissory: number
    voided: number
    /** Payable this term, signature + end-of-term report in, not released yet. */
    ready_to_release: number
    /** Payable this term but still missing the signature or the report. */
    missing_requirements: number
  }
  integrity: { office: string; logs: number; flagged: number; auto_clock_outs: number; rejected: number; missing_task: number }[]
  workload: {
    supervisor_id: number
    name: string
    pending: number
    pending_hours: number
    oldest_pending_days: number | null
    verified: number
    avg_verify_hours: number | null
  }[]
  funnel: {
    submitted: number
    interviewed: number
    approved: number
    rejected: number
    waiting: number
    no_shows: number
    avg_days_to_decision: number | null
    by_college: { college: string; total: number; approved: number; rejected: number }[]
  }
  offices: { office: string; capacity: number; filled: number; verified_hours: number; avg_completion: number | null }[]
}
