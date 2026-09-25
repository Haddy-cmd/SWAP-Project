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
import { EmptyChart } from './EmptyChart'

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
  if (!data.length) return <EmptyChart message="No applications this period" />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCE0CF" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6F7B74' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #DCE0CF',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        <Bar dataKey="submitted" name="Submitted" fill="#2A7148" radius={[4, 4, 0, 0]} />
        <Bar dataKey="approved" name="Approved" fill="#1F8163" radius={[4, 4, 0, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="#D92D20" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
