'use client'

import { Calendar, ChevronDown } from 'lucide-react'

export interface Term {
  academic_year: string
  semester: string
}

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']
const SELECT = 'h-[42px] cursor-pointer appearance-none rounded-[11px] border border-ink-200 bg-white text-[13.5px] font-semibold text-ink-900 shadow-[0_2px_6px_rgba(19,36,26,0.05)] hover:bg-ink-50 focus:border-brand-700 focus:outline-none'

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

/** School-year + semester pickers; years come from the terms that have data. */
export function TermSelect({ term, periods, onChange }: { term: Term; periods: Term[]; onChange: (t: Term) => void }) {
  const years = Array.from(new Set([...periods.map((p) => p.academic_year), term.academic_year])).sort().reverse()

  return (
    <div className="flex gap-2.5">
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-600" />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <select aria-label="School year" value={term.academic_year} onChange={(e) => onChange({ ...term, academic_year: e.target.value })} className={`${SELECT} pl-10 pr-9`}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="relative">
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <select aria-label="Semester" value={term.semester} onChange={(e) => onChange({ ...term, semester: e.target.value })} className={`${SELECT} pl-4 pr-9`}>
          {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )
}
