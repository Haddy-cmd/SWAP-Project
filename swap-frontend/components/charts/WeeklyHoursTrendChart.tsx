'use client'

import {
  LineChart,
  Line,
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

interface WeeklyHoursTrendChartProps {
  data: WeeklyDataPoint[]
}

export function WeeklyHoursTrendChart({ data }: WeeklyHoursTrendChartProps) {
  if (!data.length) return <EmptyChart message="No service hours recorded this period" />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCE0CF" />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #DCE0CF',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        <Line
          type="monotone"
          dataKey="verified"
          name="Verified Hours"
          stroke="#1F8163"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="pending"
          name="Pending Hours"
          stroke="#D97706"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
