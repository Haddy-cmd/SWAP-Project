'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import { formatDateTime } from '@/lib/utils/formatDate'

interface AuditLog {
  id: number
  user_id: number | null
  action: string
  auditable_type: string
  auditable_id: number
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user?: { name: string; email: string }
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => analyticsApi.getAuditLogs(page),
  })

  const logs = ((data as { data?: AuditLog[] })?.data ?? [])
  const meta = (data as { meta?: { current_page: number; last_page: number; total: number } })?.meta

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Audit Logs</h1>
        <p className="mt-1 text-sm text-[#64748B]">All system actions with user attribution.</p>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !logs.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-[#CBD5E1]" />
            <p className="text-sm text-[#94A3B8]">No audit logs found.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                        log.action === 'create' ? 'bg-green-50 text-[#27AE60]'
                          : log.action === 'delete' ? 'bg-red-50 text-[#E74C3C]'
                          : 'bg-blue-50 text-[#2980B9]'
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {log.auditable_type.split('\\').pop()} #{log.auditable_id}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <span className="font-medium text-[#1E293B]">{log.user.name}</span>
                      ) : (
                        <span className="text-[#94A3B8]">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#94A3B8]">{log.ip_address ?? '—'}</td>
                    <td className="px-4 py-3 text-[#64748B]">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3">
                <p className="text-xs text-[#64748B]">Page {meta.current_page} of {meta.last_page} · {meta.total} total</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === meta.last_page}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
