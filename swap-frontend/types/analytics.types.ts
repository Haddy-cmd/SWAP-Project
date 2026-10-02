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
  total_released: number
  total_pending: number
}

export type StipendStatus = 'pending' | 'certified' | 'claimed' | 'void' | 'released'

export interface StipendSignatureView {
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
  claimed_at: string | null
  releasing_officer_name: string | null
  void_reason: string | null
  has_slip: boolean
  remarks: string | null
  // Released through an approved promissory note: the term's shortfall and the
  // makeup the note promised, recorded at release (printed on the stub).
  via_promissory?: boolean
  promissory_note_id?: number | null
  required_hours?: number | null
  deficient_hours?: number | null
  lacking_hours?: number | null
  makeup_deadline?: string | null
  created_at: string
  recipient?: import('./auth.types').User
  certifier?: { id: number; name: string } | null
  signatures?: StipendSignatureView[]
}

// Mirrors StipendVerifyController::show — only what the Banking Office needs to pay.
export interface ClaimVerification {
  control_number: string
  recipient_name: string | null
  // To match against the student's ID card at the window.
  student_id_number?: string | null
  amount: number | string
  academic_year: string
  semester: string
  period_label: string | null
  certified_at: string | null
  status: StipendStatus
  // Who the payout will be recorded under (set by the DSA with the PIN); null until set up.
  releasing_officer_name: string | null
}

// Mirrors StipendVerifyController::release.
export interface ClaimReleaseResult {
  control_number: string
  status: StipendStatus
  claimed_at: string | null
  releasing_officer_name: string
}

// Mirrors Admin\StipendController::bankingOfficePin — never the PIN itself.
export interface BankingOfficePinStatus {
  is_set: boolean
  has_pin: boolean
  officer_name: string | null
  updated_at: string | null
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
  makeup_deadline?: string | null
  // Release also needs these (StipendClaimService refuses without them).
  assignment_id?: number
  has_signature: boolean
  narrative_submitted: boolean
}
