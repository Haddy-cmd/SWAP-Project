/**
 * Admin → Analytics "All semesters": the term picker's `ay=all` (URL) stands for every term.
 * The API takes no term for that (backend TermScope), so termParams() leaves both out.
 */
export const ALL_TERMS = 'all'

export const isAllTerms = (academicYear: string) => academicYear === ALL_TERMS

export function termParams(academicYear: string, semester: string): { academic_year?: string; semester?: string } {
  return isAllTerms(academicYear) ? {} : { academic_year: academicYear, semester }
}

/** For download names: "all-semesters" or "2026-2027-1stsemester". */
export function termSlug(academicYear: string, semester: string): string {
  return isAllTerms(academicYear) ? 'all-semesters' : `${academicYear}-${semester.replace(/\s+/g, '').toLowerCase()}`
}
