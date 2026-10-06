'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ChevronDown, MousePointerClick } from 'lucide-react'
import type { ReportColumn, ReportGroup } from '@/types/report.types'
import { formatCell, SERIES } from './format'

/** More bars than this stop being readable; the rest are summed into "Others". */
const MAX_BARS = 12

interface Props {
  columns: ReportColumn[]
  groups: ReportGroup[]
  groupBy: string | null
  metric: string | null
  /** Values of the group column currently filtered on (highlighted bars). */
  selected: string[]
  onGroupBy: (key: string) => void
  onMetric: (key: string | undefined) => void
  /** Clicking a bar filters the report to that value (or removes it). */
  onBarClick: (value: string) => void
}

const SELECT = 'h-8 cursor-pointer appearance-none rounded-lg border border-ink-200 bg-white pl-2.5 pr-7 text-[12.5px] font-semibold text-ink-800 focus:border-brand-700 focus:outline-none'

export function GroupChart({ columns, groups, groupBy, metric, selected, onGroupBy, onMetric, onBarClick }: Props) {
  const groupable = columns.filter((c) => c.filterable)
  const metrics = columns.filter((c) => c.metric)
  const metricCol = columns.find((c) => c.key === metric)
  const groupLabel = columns.find((c) => c.key === groupBy)?.label ?? ''

  const top = groups.slice(0, MAX_BARS)
  const rest = groups.slice(MAX_BARS)
  const data = rest.length
    ? [...top, { label: `Others (${rest.length})`, value: rest.reduce((s, g) => s + g.value, 0), count: rest.reduce((s, g) => s + g.count, 0), others: true }]
    : top
  const fmt = (v: number) => (metricCol ? formatCell(v, metricCol.type) : v.toLocaleString('en-PH'))
  const height = Math.max(180, data.length * 38 + 30)

  if (!groupable.length) return null

  return (
    <div className="rounded-[15px] border border-ink-200 bg-white p-5 shadow-[0_2px_8px_rgba(19,36,26,0.04)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-[14px] font-bold text-ink-950">
          <BarChart3 className="h-4 w-4 text-brand-700" />
          {metricCol ? metricCol.label : 'Records'} by
        </span>
        <div className="relative">
          <select aria-label="Group by" value={groupBy ?? ''} onChange={(e) => onGroupBy(e.target.value)} className={SELECT}>
            {groupable.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        </div>
        {metrics.length > 0 && (
          <>
            <span className="text-[12.5px] text-ink-500">showing</span>
            <div className="relative">
              <select aria-label="Measure" value={metric ?? ''} onChange={(e) => onMetric(e.target.value || undefined)} className={SELECT}>
                <option value="">Number of records</option>
                {metrics.map((c) => <option key={c.key} value={c.key}>Total {c.label.toLowerCase()}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            </div>
          </>
        )}
        <span className="ml-auto hidden items-center gap-1 text-[11.5px] text-ink-400 sm:flex">
          <MousePointerClick className="h-3.5 w-3.5" /> Click a bar to filter by {groupLabel.toLowerCase()}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[140px] items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 text-[12.5px] text-ink-500">
          No records to chart with these filters.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEFE2" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11.5, fill: '#6F7B74' }} axisLine={false} tickLine={false} tickFormatter={fmt} allowDecimals={!!metricCol} />
            <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11.5, fill: '#34433A' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#F7F6EE' }}
              contentStyle={{ borderRadius: '0.5rem', border: '1px solid #DCE0CF', fontSize: '0.75rem' }}
              formatter={(v: number, _n, item) => [
                metricCol ? `${fmt(v)} (${(item.payload as ReportGroup).count} records)` : fmt(v),
                metricCol ? metricCol.label : 'Records',
              ]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer"
              label={{ position: 'right', fontSize: 11, fill: '#34433A', formatter: fmt }}
              onClick={(d: { label?: string; others?: boolean }) => { if (d?.label && !d.others) onBarClick(d.label) }}>
              {data.map((g, i) => {
                const dim = selected.length > 0 && !selected.includes(g.label)
                return <Cell key={g.label} fill={'others' in g ? '#CAD2BC' : SERIES[i % SERIES.length]} fillOpacity={dim ? 0.3 : 1} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
