export interface Assignment {
  id: number
  user_id: number
  office_id: number
  supervisor_id: number
  academic_year: string
  semester: string
  required_hours: number
  /** Unfinished promissory makeup hours added from the previous term (included in required_hours). */
  carried_over_hours?: number
  carried_from_term?: string | null
  pending_required_hours?: number | null
  start_date: string
  end_date: string | null
  status: 'active' | 'completed' | 'suspended'
  qr_code: string | null
  rendered_hours: number
  verified_hours: number
  pending_hours: number
  remaining_hours: number
  /** Progress against the elapsed term, computed server-side. */
  pace: import('@/lib/utils/pace').Pace
  created_at: string
  user?: import('./auth.types').User
  office?: Office
  supervisor?: import('./auth.types').User
  /** Whether this recipient's supervisor requires a selfie at clock-in. */
  selfie_required?: boolean
  /** The term's last day: its own end date, else its semester period's (YYYY-MM-DD). */
  effective_end_date?: string | null
  /** Persisted end-of-term verdict; null while the term is in progress. */
  term_status?: 'qualified' | 'deficient' | null
  /** Hours short when the term was judged deficient (kept after a makeup). */
  deficient_hours?: number | null
  term_status_reason?: string | null
  term_status_at?: string | null
  term_badge?: TermBadgeValue
  /** Supervisor roster only: the end-of-term report's state and whether it waits for acceptance. */
  term_report?: { submitted_at: string | null; reviewed_at: string | null; renewal_eligible: boolean | null } | null
  report_to_review?: boolean
}

export type TermBadgeValue = 'qualified' | 'promissory_approved' | 'promissory_pending' | 'deficient' | 'in_progress'

/** One earlier term on the recipient's Hours page (AttendanceService::termHistory). */
export interface TermHistoryItem {
  assignment_id: number
  academic_year: string
  semester: string
  office: string | null
  status: 'completed' | 'suspended'
  start_date: string | null
  end_date: string | null
  required_hours: number
  verified_hours: number
  rendered_hours: number
  term_status: 'qualified' | 'deficient' | null
  term_badge: TermBadgeValue
  deficient_hours: number | null
  stipend_status: string | null
  stipend_via_promissory: boolean
  /** The term's stub amount (not void), and when it was released (received, on legacy stubs). */
  stipend_amount: number | null
  stipend_released_at: string | null
}

/** The supervisor student page's term block (StudentController::termPayload). */
export interface StudentTerm {
  badge: TermBadgeValue
  status: 'qualified' | 'deficient' | null
  deficient_hours: number | null
  reason: string | null
  marked_at: string | null
  /** false = recorded by the end-of-semester check */
  marked_by_supervisor: boolean
  effective_end_date: string | null
  /** Hours still short right now (0 when met). */
  shortfall: number
}

export interface Office {
  id: number
  name: string
  logo_url: string | null
  description: string | null
  head_name: string | null
  location: string | null
  max_recipients: number
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  radius_meters: number | null
  geofence_enabled: boolean
  auto_clock_out?: boolean
  qr_code?: string | null
  active_recipients?: number
  supervisors_count?: number
}

export interface CreateAssignmentData {
  user_id: number
  office_id: number
  supervisor_id: number
  academic_year: string
  semester: string
  required_hours: number
  start_date: string
  end_date?: string
}
