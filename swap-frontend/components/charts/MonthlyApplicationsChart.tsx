'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface MonthlyDataPoint {
  month: string
  submitted: number
  approved: number
  rejected: number
}

interface MonthlyApplicationsChartProps {
  data: MonthlyDataPoint[]
}

export function MonthlyApplicationsChart({ data }: MonthlyApplicationsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #E2E8F0',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        <Bar dataKey="submitted" name="Submitted" fill="#2980B9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="approved" name="Approved" fill="#27AE60" radius={[4, 4, 0, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="#E74C3C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
