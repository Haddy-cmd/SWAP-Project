'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { EmptyChart } from './EmptyChart'

interface OfficeDataPoint {
  office: string
  count: number
}

interface OfficeDistributionChartProps {
  data: OfficeDataPoint[]
}

// Seal-derived series order: green, gold, maroon, blue, teal, violet, grey, amber.
const COLORS = [
  '#1F5B3A',
  '#D4AE22',
  '#A31A1E',
  '#2F5D8A',
  '#1F8163',
  '#6B4E9A',
  '#8C968F',
  '#D97706',
]

export function OfficeDistributionChart({ data }: OfficeDistributionChartProps) {
  if (!data.length) return <EmptyChart message="No recipients assigned this period" />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="office"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ office, percent }) =>
            `${office} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [value, 'Recipients']}
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #DCE0CF',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
