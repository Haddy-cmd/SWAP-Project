'use client'

import { Calendar, ChevronDown } from 'lucide-react'
import { ALL_TERMS, isAllTerms } from '@/lib/utils/term'

export interface Term {
  academic_year: string
  semester: string
}

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']
const SELECT = 'h-[42px] cursor-pointer appearance-none rounded-[11px] border border-ink-200 bg-surface text-[13.5px] font-semibold text-ink-900 shadow-[0_2px_6px_rgba(19,36,26,0.05)] hover:bg-ink-50 focus:border-brand-700 focus:outline-none'

/** The school year a date falls in (June starts a new one), e.g. "2026-2027". */
export function schoolYearOf(d = new Date()): string {
  const y = d.getFullYear()
  return d.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

/**
 * The term to show: the URL's, else the newest term with data, else the current
 * school year's first semester.
 */
export function resolveTerm(ay: string | null, sem: string | null, periods: Term[]): Term {
  if (ay && sem) return { academic_year: ay, semester: sem }
  return periods[0] ?? { academic_year: schoolYearOf(), semester: SEMESTERS[0] }
}

/**
 * School-year + semester pickers; years come from the terms that have data.
 * `allowAll` adds "All semesters" first (admin analytics); the semester picker hides while it's on.
 */
export function TermSelect({ term, periods, onChange, allowAll = false }: {
  term: Term; periods: Term[]; onChange: (t: Term) => void; allowAll?: boolean
}) {
  const all = isAllTerms(term.academic_year)
  const years = Array.from(new Set([...periods.map((p) => p.academic_year), ...(all ? [] : [term.academic_year])])).sort().reverse()
  const pickYear = (academic_year: string) => onChange(
    isAllTerms(academic_year)
      ? { academic_year: ALL_TERMS, semester: ALL_TERMS }
      // Leaving "All semesters" starts at the first semester.
      : { academic_year, semester: all ? SEMESTERS[0] : term.semester },
  )

  return (
    <div className="flex gap-2.5">
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-600" />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <select aria-label="School year" value={term.academic_year} onChange={(e) => pickYear(e.target.value)} className={`${SELECT} pl-10 pr-9`}>
          {allowAll && <option value={ALL_TERMS}>All semesters</option>}
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {!all && (
        <div className="relative">
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <select aria-label="Semester" value={term.semester} onChange={(e) => onChange({ ...term, semester: e.target.value })} className={`${SELECT} pl-4 pr-9`}>
            {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
