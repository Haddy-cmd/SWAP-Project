'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { EmptyChart } from './EmptyChart'

interface WeeklyDataPoint {
  week: string
  verified: number
  pending: number
}

export type WeeklyHoursChartType = 'line' | 'area' | 'column'

interface WeeklyHoursTrendChartProps {
  data: WeeklyDataPoint[]
  /** Line by default; the admin dashboard lets the viewer switch. */
  type?: WeeklyHoursChartType
}

const VERIFIED = '#1F8163'
const PENDING = '#D97706'

export function WeeklyHoursTrendChart({ data, type = 'line' }: WeeklyHoursTrendChartProps) {
  if (!data.length) return <EmptyChart message="No service hours recorded this period" />

  const margin = { top: 5, right: 20, left: 0, bottom: 5 }
  const axes = [
    <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#DCE0CF" vertical={false} />,
    <XAxis key="x" dataKey="week" tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />,
    <YAxis key="y" tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />,
    <Tooltip key="tip" cursor={type === 'column' ? { fill: '#F7F6EE' } : undefined}
      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #DCE0CF', fontSize: '0.75rem' }} />,
    <Legend key="legend" wrapperStyle={{ fontSize: '0.75rem' }} />,
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      {type === 'area' ? (
        <AreaChart data={data} margin={margin}>
          {axes}
          <Area type="monotone" dataKey="verified" name="Verified Hours" stroke={VERIFIED} strokeWidth={2} fill={VERIFIED} fillOpacity={0.18} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="pending" name="Pending Hours" stroke={PENDING} strokeWidth={2} strokeDasharray="5 5" fill={PENDING} fillOpacity={0.12} activeDot={{ r: 5 }} />
        </AreaChart>
      ) : type === 'column' ? (
        <BarChart data={data} margin={margin} barGap={2}>
          {axes}
          <Bar dataKey="verified" name="Verified Hours" fill={VERIFIED} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="pending" name="Pending Hours" fill={PENDING} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      ) : (
        <LineChart data={data} margin={margin}>
          {axes}
          <Line type="monotone" dataKey="verified" name="Verified Hours" stroke={VERIFIED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="pending" name="Pending Hours" stroke={PENDING} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="5 5" />
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}
