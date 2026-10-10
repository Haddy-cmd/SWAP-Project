import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { ReportParams, ReportResult, ReportRole } from '@/types/report.types'

/** Drop empty values so the query string (and the cache key) stays minimal. */
function clean(params: ReportParams): Record<string, unknown> {
  const filters = Object.fromEntries(Object.entries(params.filters ?? {}).filter(([, v]) => v.length > 0))
  return Object.fromEntries(
    Object.entries({ ...params, filters: Object.keys(filters).length ? filters : undefined })
      .filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

export const reportsApi = {
  /** One report, filtered/sorted/grouped server-side (`filters[college][]=CICS`). */
  get: (role: ReportRole, type: string, params: ReportParams) =>
    apiClient.get<ApiResponse<ReportResult>>(`/${role}/reports/${type}`, { params: clean(params) })
      .then((r) => r.data.data),

  /** The same rows as a file. Returns the blob and the server's filename. A PDF can leave out the graph. */
  export: (role: ReportRole, type: string, params: ReportParams, format: 'pdf' | 'csv', options: { includeChart?: boolean } = {}) =>
    apiClient.get<Blob>(`/${role}/reports/${type}/export`, {
      params: { ...clean(params), format, ...(format === 'pdf' && options.includeChart === false ? { include_chart: 0 } : {}) },
      responseType: 'blob',
    })
      .then((r) => ({ blob: r.data, filename: filenameFrom(r.headers['content-disposition']) }))
      .catch(rethrowBlobError),

  /** Admin: the term's KPIs and program insights as one PDF. */
  overviewPdf: (academicYear: string, semester: string) =>
    apiClient.get<Blob>('/admin/analytics/overview/export', { params: { academic_year: academicYear, semester }, responseType: 'blob' })
      .then((r) => ({ blob: r.data, filename: filenameFrom(r.headers['content-disposition']) }))
      .catch(rethrowBlobError),
}

function filenameFrom(header: unknown): string | null {
  const m = typeof header === 'string' ? /filename="?([^";]+)"?/.exec(header) : null
  return m ? m[1] : null
}

/**
 * A failed blob download carries its JSON error as a Blob, so the interceptor can't
 * read the message (e.g. "too many rows for a PDF"). Read it here and rethrow it.
 */
async function rethrowBlobError(err: unknown): Promise<never> {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) throw Object.assign(new Error(parsed.message), { errors: {} })
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e
    }
  }
  throw err
}
