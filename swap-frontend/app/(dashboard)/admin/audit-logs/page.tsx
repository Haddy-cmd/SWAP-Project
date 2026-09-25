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
        <h1 className="text-2xl font-bold text-ink-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-ink-500">All system actions with user attribution.</p>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-200" />)}</div>
        ) : !logs.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-ink-300" />
            <p className="text-sm text-ink-350">No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                        log.action === 'create' ? 'bg-success-50 text-success-600'
                          : log.action === 'delete' ? 'bg-danger-50 text-danger-600'
                          : 'bg-info-50 text-brand-600'
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {log.auditable_type.split('\\').pop()} #{log.auditable_id}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <span className="font-medium text-ink-900">{log.user.name}</span>
                      ) : (
                        <span className="text-ink-350">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-350">{log.ip_address ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
                <p className="text-xs text-ink-500">Page {meta.current_page} of {meta.last_page} · {meta.total} total</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40 transition-colors">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === meta.last_page}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
