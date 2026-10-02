// Hand-mirrored from the backend SemesterPeriodResource.

export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'] as const
export type Semester = (typeof SEMESTERS)[number]

export type SemesterPhase = 'upcoming' | 'current' | 'ended'

export interface SemesterPeriod {
  id: number
  academic_year: string
  semester: Semester
  // "1st Semester 2026-2027"
  label: string
  // YYYY-MM-DD (Manila calendar days)
  start_date: string
  end_date: string
  // Returning recipients can renew for this term (one period at a time).
  renewal_open: boolean
  phase: SemesterPhase
  // Whole days left in the current term (0 on its last day); null otherwise.
  days_left: number | null
  // When the end-of-term job closed it.
  closed_at: string | null
}

export interface CurrentSemester {
  current: SemesterPeriod | null
  // Only when there is no current term: the next one that hasn't started.
  next: SemesterPeriod | null
  renewal: SemesterPeriod | null
}

export interface SemesterPeriodInput {
  academic_year: string
  semester: string
  start_date: string
  end_date: string
  renewal_open: boolean
}
