'use client'

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ChevronDown, MousePointerClick } from 'lucide-react'
import type { ReportColumn, ReportGroup } from '@/types/report.types'
import { formatCell, SERIES } from './format'
import { ChartTypeToggle, useChartType } from '@/components/charts/ChartTypeToggle'

/** More bars than this stop being readable; the rest are summed into "Others". */
const MAX_BARS = 12
/** A pie stays readable with fewer slices: one per series colour, the rest in "Others". */
const MAX_SLICES = SERIES.length - 1

const TYPES = ['bar', 'column', 'line', 'pie'] as const
const CLICK_HINT = { bar: 'a bar', column: 'a column', line: 'a point', pie: 'a slice' } as const
type Datum = ReportGroup & { others?: boolean }

/** The first `max` groups, the rest summed into one "Others" entry. */
function fold(groups: ReportGroup[], max: number): Datum[] {
  const rest = groups.slice(max)
  return rest.length
    ? [...groups.slice(0, max), { label: `Others (${rest.length})`, value: rest.reduce((s, g) => s + g.value, 0), count: rest.reduce((s, g) => s + g.count, 0), others: true }]
    : groups
}

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

  const [type, setType] = useChartType('report-group', TYPES, 'bar')
  const data = fold(groups, type === 'pie' ? MAX_SLICES : MAX_BARS)
  const fmt = (v: number) => (metricCol ? formatCell(v, metricCol.type) : v.toLocaleString('en-PH'))
  const height = type === 'bar' ? Math.max(180, data.length * 38 + 30) : 300
  // Clicking a mark filters the report to that value ("Others" isn't one value).
  const pick = (d?: { label?: string; others?: boolean } | null) => { if (d?.label && !d.others) onBarClick(d.label) }
  const fillFor = (g: Datum, i: number) => (g.others ? '#CAD2BC' : SERIES[i % SERIES.length])
  const dim = (g: Datum) => selected.length > 0 && !selected.includes(g.label)
  const tilted = data.length > 6
  const tooltip = (
    <Tooltip cursor={type === 'line' ? { stroke: '#CAD2BC' } : { fill: '#F7F6EE' }}
      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #DCE0CF', fontSize: '0.75rem' }}
      formatter={(v: number, _n, item) => [
        metricCol ? `${fmt(v)} (${(item.payload as ReportGroup).count} records)` : fmt(v),
        metricCol ? metricCol.label : 'Records',
      ]} />
  )

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
          <MousePointerClick className="h-3.5 w-3.5" /> Click {CLICK_HINT[type]} to filter by {groupLabel.toLowerCase()}
        </span>
        <ChartTypeToggle label="Report graph" value={type} options={TYPES} onChange={setType} />
      </div>

      {data.length === 0 ? (
        <div className="flex h-[140px] items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 text-[12.5px] text-ink-500">
          No records to chart with these filters.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {type === 'pie' ? (
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              {tooltip}
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={1}
                stroke="#FFFFFF" strokeWidth={2} cursor="pointer" isAnimationActive={false}
                label={({ percent }: { percent: number }) => (percent >= 0.05 ? `${Math.round(percent * 100)}%` : '')}
                onClick={(d: { payload?: Datum }) => pick(d?.payload)}>
                {data.map((g, i) => <Cell key={g.label} fill={fillFor(g, i)} fillOpacity={dim(g) ? 0.3 : 1} />)}
              </Pie>
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={9}
                wrapperStyle={{ fontSize: '0.75rem', color: '#34433A', maxWidth: '45%' }} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
              onClick={(state) => pick(state?.activePayload?.[0]?.payload as Datum | undefined)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEFE2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#34433A' }} axisLine={false} tickLine={false} interval={0}
                angle={tilted ? -25 : 0} textAnchor={tilted ? 'end' : 'middle'} height={tilted ? 70 : 30} />
              <YAxis tick={{ fontSize: 11.5, fill: '#6F7B74' }} axisLine={false} tickLine={false} tickFormatter={fmt} allowDecimals={!!metricCol} />
              {tooltip}
              <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} cursor="pointer"
                dot={{ r: 4, fill: SERIES[0] }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : type === 'column' ? (
            <BarChart data={data} margin={{ top: 20, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEFE2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#34433A' }} axisLine={false} tickLine={false} interval={0}
                angle={tilted ? -25 : 0} textAnchor={tilted ? 'end' : 'middle'} height={tilted ? 70 : 30} />
              <YAxis tick={{ fontSize: 11.5, fill: '#6F7B74' }} axisLine={false} tickLine={false} tickFormatter={fmt} allowDecimals={!!metricCol} />
              {tooltip}
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} cursor="pointer"
                label={{ position: 'top', fontSize: 11, fill: '#34433A', formatter: fmt }}
                onClick={(d: Datum) => pick(d)}>
                {data.map((g, i) => <Cell key={g.label} fill={fillFor(g, i)} fillOpacity={dim(g) ? 0.3 : 1} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEFE2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11.5, fill: '#6F7B74' }} axisLine={false} tickLine={false} tickFormatter={fmt} allowDecimals={!!metricCol} />
              <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11.5, fill: '#34433A' }} axisLine={false} tickLine={false} />
              {tooltip}
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer"
                label={{ position: 'right', fontSize: 11, fill: '#34433A', formatter: fmt }}
                onClick={(d: Datum) => pick(d)}>
                {data.map((g, i) => <Cell key={g.label} fill={fillFor(g, i)} fillOpacity={dim(g) ? 0.3 : 1} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}
