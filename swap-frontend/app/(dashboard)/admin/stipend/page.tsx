'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Send, CheckCircle } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord, EligibleStipend } from '@/types/analytics.types'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function AdminStipendPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user_id: '', amount: '', academic_year: '2024-2025', semester: '1st Semester', remarks: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stipend', page],
    queryFn: () => adminApi.getStipendRecords({ page: String(page) }),
  })

  const { data: eligible = [] } = useQuery({
    queryKey: ['admin-stipend-eligible'],
    queryFn: () => adminApi.getEligibleStipends(),
  })

  function prefillRelease(e: EligibleStipend) {
    setForm({
      user_id: String(e.user_id),
      amount: String(e.suggested_amount),
      academic_year: e.academic_year,
      semester: e.semester,
      remarks: 'Completed required service hours.',
    })
    setShowForm(true)
  }

  const release = useMutation({
    mutationFn: () => adminApi.releaseStipend({
      user_id: Number(form.user_id),
      amount: Number(form.amount),
      academic_year: form.academic_year,
      semester: form.semester,
      remarks: form.remarks,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stipend'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stipend-eligible'] })
      setShowForm(false)
      setForm({ user_id: '', amount: '', academic_year: '2024-2025', semester: '1st Semester', remarks: '' })
    },
  })

  const records = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Stipend Management</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[#1B4F72] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors">
          <Send className="h-4 w-4" />
          Release Stipend
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-[#1E293B]">Release Stipend</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Recipient ID</label>
              <input type="number" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Amount (PHP)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
            </div>
          </div>
          <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Remarks (optional)"
            className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
          <div className="flex gap-3">
            <button onClick={() => release.mutate()} disabled={release.isPending || !form.user_id || !form.amount}
              className="rounded-xl bg-[#27AE60] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {release.isPending ? 'Releasing…' : 'Confirm Release'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {eligible.length > 0 && (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#16A34A]" />
            <h2 className="font-semibold text-[#166534]">Eligible for Release</h2>
            <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">{eligible.length}</span>
          </div>
          <p className="mb-3 text-xs text-[#15803D]">Recipients who completed their required verified hours and have not been paid for the period.</p>
          <div className="space-y-2">
            {eligible.map((e) => (
              <div key={`${e.user_id}-${e.academic_year}-${e.semester}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#BBF7D0] bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1E293B]">{e.name}</p>
                  <p className="text-xs text-[#64748B]">
                    {e.academic_year} — {e.semester} · {e.verified_hours}/{e.required_hours} hrs verified
                  </p>
                </div>
                <button
                  onClick={() => prefillRelease(e)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#27AE60] px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  Release {PHP.format(e.suggested_amount)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <DollarSign className="h-10 w-10 text-[#CBD5E1]" />
            <p className="text-sm text-[#94A3B8]">No stipend records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Released</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: StipendRecord) => (
                <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#1E293B]">{r.recipient?.name ?? `User #${r.user_id}`}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1B4F72]">{PHP.format(r.amount)}</td>
                  <td className="px-4 py-3 text-[#64748B]">{r.academic_year} — {r.semester}</td>
                  <td className="px-4 py-3 text-[#64748B]">{r.released_at ? formatDate(r.released_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.status === 'released' ? 'bg-green-50 text-[#27AE60]' : 'bg-yellow-50 text-[#F39C12]'
                    }`}>{r.status}</span>
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
