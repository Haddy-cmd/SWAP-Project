'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { reportsApi } from '@/lib/api/reports.api'
import { errorText } from '@/lib/utils/apiError'
import { nextSort, toggleFilter } from '@/lib/utils/reportQuery'
import type { ReportParams, ReportQueryState, ReportRole } from '@/types/report.types'
import { FilterBar } from './FilterBar'
import { GroupChart } from './GroupChart'
import { ReportTable } from './ReportTable'
import { ExportButtons } from './ExportButtons'

interface Props {
  role: ReportRole
  type: string
  /** For per-term reports; omitted for a recipient's own (all-term) reports. */
  term?: { academic_year: string; semester: string } | null
  state: ReportQueryState
  onChange: (patch: Partial<ReportQueryState>) => void
}

/**
 * One report: KPI tiles, filters, a clickable chart and a sortable table, with
 * PDF/CSV downloads of exactly what is shown. Filtering, sorting and grouping run
 * on the server (GET /{role}/reports/{type}), so the files always match the screen.
 */
export function ReportExplorer({ role, type, term, state, onChange }: Props) {
  const params: ReportParams = { ...state, ...(term ?? {}) }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['report', role, type, params],
    queryFn: () => reportsApi.get(role, type, params),
    placeholderData: keepPreviousData,
  })

  if (isLoading) return <div className="h-[560px] animate-pulse rounded-[15px] bg-ink-100" />
  if (error && !data) {
    return (
      <div className="flex items-center gap-3 rounded-[15px] border border-danger-200 bg-danger-50 p-5 text-[13px] text-danger-700">
        <AlertTriangle className="h-5 w-5 flex-none" /> {errorText(error, 'This report could not be loaded.')}
      </div>
    )
  }
  if (!data) return null

  const groupBy = state.group_by ?? data.group_by ?? undefined
  const filtered = data.rows.length !== data.total_rows
  const summary = filtered ? `${data.rows.length} of ${data.total_rows} records` : `${data.total_rows} records`
  const fallbackName = `${data.slug}${term ? `-${term.academic_year}-${term.semester.replace(/\s+/g, '').toLowerCase()}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-[22px] font-semibold text-ink-950">{data.title}</h2>
          <p className="flex items-center gap-2 text-[12.5px] text-ink-500">
            {data.term && <span>{data.term} ·</span>}
            <span className={filtered ? 'font-semibold text-brand-700' : ''}>{summary}</span>
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
          </p>
        </div>
        <ExportButtons
          download={(format) => reportsApi.export(role, type, params, format)}
          fallbackName={fallbackName}
          disabled={data.rows.length === 0}
          summary={summary}
        />
      </div>

      {data.stats.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${data.stats.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {data.stats.map((s) => (
            <div key={s.label} className="rounded-[13px] border border-ink-200 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(19,36,26,0.04)]">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">{s.label}</div>
              <div className="mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums text-ink-950">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <FilterBar columns={data.columns} facets={data.facets} filters={state.filters} search={state.search}
        onFilters={(filters) => onChange({ filters })}
        onSearch={(search) => onChange({ search })} />

      <GroupChart columns={data.columns} groups={data.groups} groupBy={groupBy ?? null} metric={data.metric}
        selected={groupBy ? state.filters[groupBy] ?? [] : []}
        onGroupBy={(key) => onChange({ group_by: key })}
        onMetric={(metric) => onChange({ metric })}
        onBarClick={(value) => groupBy && onChange({ filters: toggleFilter(state.filters, groupBy, value) })} />

      <ReportTable columns={data.columns} rows={data.rows} sort={state.sort} dir={state.dir}
        onSort={(key) => onChange(nextSort(state, key))} />
    </div>
  )
}
