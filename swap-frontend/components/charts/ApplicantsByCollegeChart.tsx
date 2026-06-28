'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { EmptyChart } from './EmptyChart'

interface CollegeDataPoint {
  college: string
  value: number
}

interface ApplicantsByCollegeChartProps {
  data: CollegeDataPoint[]
  /** Series name shown in the tooltip (e.g. "Applicants" or "Recipients"). */
  label?: string
  /** Bar palette; defaults to the maroon-led set. */
  colors?: string[]
  emptyMessage?: string
}

const DEFAULT_COLORS = ['#7D1A1A', '#2980B9', '#27AE60', '#E6A817', '#C0563B', '#8E44AD', '#16A085']

/** Horizontal bars so long college names sit on the Y axis without overflowing.
 *  Reused for both "Applicants by College" and "Active Recipients by College". */
export function ApplicantsByCollegeChart({
  data,
  label = 'Applicants',
  colors = DEFAULT_COLORS,
  emptyMessage = 'No applicants this period',
}: ApplicantsByCollegeChartProps) {
  if (!data.length) return <EmptyChart message={emptyMessage} />

  const height = Math.max(260, data.length * 46)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 28, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFE3E3" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="college"
          width={172}
          tick={{ fontSize: 11.5, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#FAF7F7' }}
          contentStyle={{ borderRadius: '0.5rem', border: '1px solid #E2E8F0', fontSize: '0.75rem' }}
        />
        <Bar dataKey="value" name={label} radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
