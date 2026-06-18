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

const COLORS = [
  '#1B4F72',
  '#2980B9',
  '#27AE60',
  '#F39C12',
  '#E74C3C',
  '#8E44AD',
  '#16A085',
  '#D35400',
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
            border: '1px solid #E2E8F0',
            fontSize: '0.75rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
