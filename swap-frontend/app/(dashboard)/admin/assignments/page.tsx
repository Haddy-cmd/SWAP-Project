'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus } from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { QrDisplay } from '@/components/attendance/QrDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function AdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [qrView, setQrView] = useState<{ id: number; token: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => assignmentsApi.getAssignments(),
  })

  const regenQr = useMutation({
    mutationFn: (id: number) => assignmentsApi.regenerateQr(id),
    onSuccess: (res, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      setQrView({ id, token: res.data.qr_code })
    },
  })

  const assignments = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Assignments</h1>
      </div>

      {qrView && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-semibold text-[#1E293B]">QR Code — Assignment #{qrView.id}</h2>
            <button onClick={() => setQrView(null)} className="text-xs text-[#64748B] hover:text-[#E74C3C] transition-colors">Close</button>
          </div>
          <QrDisplay value={qrView.token} size={200} caption={`Assignment #${qrView.id}`} />
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(n => <div key={n} className="h-14 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !assignments.length ? (
          <p className="p-8 text-center text-sm text-[#94A3B8]">No assignments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Office</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Req. Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#1E293B]">{(a as Record<string, unknown> & typeof a).user?.name ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{a.office_name ?? (a as Record<string, unknown>).office_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748B]">{a.required_hours} hrs</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => a.qr_code && setQrView({ id: a.id, token: a.qr_code })}
                        disabled={!a.qr_code}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors"
                      >
                        View QR
                      </button>
                      <button
                        onClick={() => regenQr.mutate(a.id)}
                        disabled={regenQr.isPending}
                        className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#F39C12] hover:bg-yellow-50 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regen QR
                      </button>
                    </div>
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
