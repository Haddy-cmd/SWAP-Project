'use client'

import { useQuery } from '@tanstack/react-query'
import { DollarSign, CheckCircle, Clock } from 'lucide-react'
import { reportsApi } from '@/lib/api/reports.api'
import { formatDate } from '@/lib/utils/formatDate'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function StipendPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stipend-history'],
    queryFn: () => reportsApi.getStipendHistory(),
  })

  const history = data?.data ?? []
  const total = history.reduce(
    (sum: number, item: { amount?: number }) => sum + (item.amount ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Stipend History</h1>
        <p className="mt-1 text-sm text-[#64748B]">Your disbursement records from the SWAP program.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#64748B]">Total Received</p>
          <p className="mt-1 text-2xl font-bold text-[#1B4F72]">{PHP.format(total)}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#64748B]">Disbursements</p>
          <p className="mt-1 text-2xl font-bold text-[#1B4F72]">{history.length}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#64748B]">Latest Release</p>
          <p className="mt-1 text-2xl font-bold text-[#1B4F72]">
            {history[0] ? formatDate((history[0] as { released_at?: string }).released_at ?? '') : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#E2E8F0]" />)}
          </div>
        ) : !history.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <DollarSign className="h-10 w-10 text-[#CBD5E1]" />
            <p className="text-sm font-medium text-[#94A3B8]">No disbursements yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Released</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item: Record<string, unknown>, idx: number) => (
                <tr key={idx} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1E293B]">{String(item.semester ?? '—')}</td>
                  <td className="px-4 py-3 font-semibold text-[#1B4F72]">
                    {PHP.format(Number(item.amount ?? 0))}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {item.released_at ? formatDate(String(item.released_at)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.status === 'released'
                          ? 'bg-green-50 text-[#27AE60]'
                          : 'bg-yellow-50 text-[#F39C12]'
                      }`}
                    >
                      {item.status === 'released' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {String(item.status ?? 'pending')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
