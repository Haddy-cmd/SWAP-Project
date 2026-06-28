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

export interface StipendRecord {
  id: number
  user_id: number
  amount: number
  academic_year: string
  semester: string
  period_label: string | null
  status: 'pending' | 'released'
  released_by: number | null
  released_at: string | null
  remarks: string | null
  created_at: string
  recipient?: import('./auth.types').User
}

export interface EligibleStipend {
  user_id: number
  name: string
  academic_year: string
  semester: string
  required_hours: number
  verified_hours: number
  suggested_amount: number
}
