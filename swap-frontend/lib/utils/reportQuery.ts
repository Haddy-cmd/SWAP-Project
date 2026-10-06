import type { ReportQueryState } from '@/types/report.types'

/**
 * Analytics & Reports keeps the open tab, the term and every filter in the URL, so
 * Back/Forward work and a link reopens the same view:
 *   ?tab=term-results&ay=2025-2026&sem=1st+Semester&f_college=CICS&f_verdict=Deficient&sort=deficient_hours&dir=desc
 * Filters are repeated `f_<column>` params (one per value; values may contain commas).
 */
export interface ReportUrlState extends ReportQueryState {
  tab: string | null
  ay: string | null
  sem: string | null
}

/** A jump from an Overview chart or tile into a filtered report tab. */
export interface ReportDrill {
  tab: string
  filters?: Record<string, string[]>
  sort?: string
  dir?: 'asc' | 'desc'
}

const FILTER_PREFIX = 'f_'

export function parseReportUrl(params: URLSearchParams): ReportUrlState {
  const filters: Record<string, string[]> = {}
  params.forEach((value, key) => {
    if (!key.startsWith(FILTER_PREFIX) || value === '') return
    const col = key.slice(FILTER_PREFIX.length)
    filters[col] = [...(filters[col] ?? []), value]
  })
  const dir = params.get('dir')

  return {
    tab: params.get('tab'),
    ay: params.get('ay'),
    sem: params.get('sem'),
    filters,
    search: params.get('q') ?? undefined,
    sort: params.get('sort') ?? undefined,
    dir: dir === 'desc' ? 'desc' : dir === 'asc' ? 'asc' : undefined,
    group_by: params.get('group') ?? undefined,
    metric: params.get('metric') ?? undefined,
  }
}

export function buildReportUrl(state: ReportUrlState): string {
  const p = new URLSearchParams()
  if (state.tab) p.set('tab', state.tab)
  if (state.ay) p.set('ay', state.ay)
  if (state.sem) p.set('sem', state.sem)
  for (const [col, values] of Object.entries(state.filters)) {
    for (const v of values) p.append(FILTER_PREFIX + col, v)
  }
  if (state.search) p.set('q', state.search)
  if (state.sort) {
    p.set('sort', state.sort)
    p.set('dir', state.dir ?? 'asc')
  }
  if (state.group_by) p.set('group', state.group_by)
  if (state.metric) p.set('metric', state.metric)
  return p.toString()
}

/** Add the value to the column's filter, or take it off if it's there. */
export function toggleFilter(filters: Record<string, string[]>, col: string, value: string): Record<string, string[]> {
  const current = filters[col] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  const out = { ...filters }
  if (next.length) out[col] = next
  else delete out[col]
  return out
}

/** Click a header: ascending, then descending, then back to the report's own order. */
export function nextSort(state: Pick<ReportQueryState, 'sort' | 'dir'>, col: string): Pick<ReportQueryState, 'sort' | 'dir'> {
  if (state.sort !== col) return { sort: col, dir: 'asc' }
  if (state.dir !== 'desc') return { sort: col, dir: 'desc' }
  return { sort: undefined, dir: undefined }
}

/** Open a report tab fresh — nothing carried over from the previous tab but the term. */
export function drillTo(state: ReportUrlState, drill: ReportDrill): ReportUrlState {
  return {
    tab: drill.tab,
    ay: state.ay,
    sem: state.sem,
    filters: drill.filters ?? {},
    sort: drill.sort,
    dir: drill.sort ? drill.dir ?? 'asc' : undefined,
  }
}
