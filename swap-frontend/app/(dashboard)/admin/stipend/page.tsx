'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Send } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord } from '@/types/analytics.types'

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

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <DollarSign className="h-10 w-10 text-[#CBD5E1]" />
            <p className="text-sm text-[#94A3B8]">No stipend records.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
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
                    <p className="font-medium text-[#1E293B]">{(r as Record<string, unknown> & typeof r).user?.name ?? `User #${r.user_id}`}</p>
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
          </table>
        )}
      </div>
    </div>
  )
}
