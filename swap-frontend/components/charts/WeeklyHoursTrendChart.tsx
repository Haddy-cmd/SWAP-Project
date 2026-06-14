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

interface WeeklyDataPoint {
  week: string
  verified: number
  pending: number
}

interface WeeklyHoursTrendChartProps {
  data: WeeklyDataPoint[]
}

export function WeeklyHoursTrendChart({ data }: WeeklyHoursTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #E2E8F0',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        <Line
          type="monotone"
          dataKey="verified"
          name="Verified Hours"
          stroke="#27AE60"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="pending"
          name="Pending Hours"
          stroke="#F39C12"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
