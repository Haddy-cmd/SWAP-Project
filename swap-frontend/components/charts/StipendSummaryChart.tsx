'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface StipendDataPoint {
  month: string
  released: number
  pending: number
}

interface StipendSummaryChartProps {
  data: StipendDataPoint[]
}

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })

export function StipendSummaryChart({ data }: StipendSummaryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="releasedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1B4F72" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1B4F72" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F39C12" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#F39C12" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) => [PHP.format(value)]}
          contentStyle={{
            borderRadius: '0.5rem',
            border: '1px solid #E2E8F0',
            fontSize: '0.75rem',
          }}
        />
        <Area
          type="monotone"
          dataKey="released"
          name="Released"
          stroke="#1B4F72"
          strokeWidth={2}
          fill="url(#releasedGrad)"
        />
        <Area
          type="monotone"
          dataKey="pending"
          name="Pending"
          stroke="#F39C12"
          strokeWidth={2}
          fill="url(#pendingGrad)"
          strokeDasharray="5 5"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
