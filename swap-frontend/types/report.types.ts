// Analytics & Reports — mirrors ReportExplorerService::run() (backend app/Services).
// Hand-kept in sync with the backend like the other types in this folder.

export type ReportRole = 'admin' | 'supervisor' | 'recipient'

export type ReportColumnType = 'text' | 'number' | 'hours' | 'money' | 'percent' | 'date' | 'status'

export interface ReportColumn {
  key: string
  label: string
  type: ReportColumnType
  /** Has a facet dropdown and can be the chart's group. */
  filterable: boolean
  /** Can be totalled per group instead of counting rows. */
  metric: boolean
}

export type ReportCell = string | number | null

export interface ReportFacetValue {
  value: string
  count: number
}

export interface ReportGroup {
  label: string
  value: number
  count: number
}

export interface ReportResult {
  title: string
  slug: string
  term: string | null
  columns: ReportColumn[]
  rows: Record<string, ReportCell>[]
  /** Rows before filtering. */
  total_rows: number
  stats: { label: string; value: string }[]
  facets: Record<string, ReportFacetValue[]>
  group_by: string | null
  metric: string | null
  groups: ReportGroup[]
  /** "College = CICS", "Sorted by Deficient Hours ↓" — what the PDF prints. */
  filters_applied: string[]
  meta: Record<string, string>
}

/** The viewer's choices; also what the URL carries. */
export interface ReportQueryState {
  filters: Record<string, string[]>
  search?: string
  sort?: string
  dir?: 'asc' | 'desc'
  group_by?: string
  metric?: string
}

export interface ReportParams extends ReportQueryState {
  academic_year?: string
  semester?: string
}

/** The empty cell's value in facets, groups and filters (ReportQuery::BLANK). */
export const REPORT_BLANK = '(Blank)'
