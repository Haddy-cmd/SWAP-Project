'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { History, X } from 'lucide-react'
import { auditApi } from '@/lib/api/analytics.api'
import { AuditEntryRow } from '@/components/admin/AuditEntryRow'

/** Which trail to show: one record (`application:12`) or everything about one account. */
export type AuditScope = { record: string } | { subjectUserId: number }

const toFilters = (scope: AuditScope): Record<string, string> =>
  'record' in scope ? { record: scope.record } : { subject_user_id: String(scope.subjectUserId) }

/**
 * A record's own audit trail, newest first, with "Show more" and a link to the full Audit Logs
 * page already filtered. Used inline (application detail) and inside AuditHistoryDrawer.
 */
export function AuditHistory({ scope, title = 'History' }: { scope: AuditScope; title?: string }) {
  const [page, setPage] = useState(1)
  const filters = toFilters(scope)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-history', filters, page],
    queryFn: () => auditApi.list({ ...filters, page: String(page) }),
  })
  const entries = data?.data ?? []
  const meta = data?.meta

  return (
    <section className="rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><History className="h-4 w-4 text-brand-700" /> {title}</h2>
        <Link href={`/admin/audit-logs?${new URLSearchParams(filters).toString()}`} className="text-xs font-semibold text-brand-700 hover:underline">
          Open in Audit Logs
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">{[1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}</div>
      ) : isError ? (
        <p className="p-4 text-sm text-danger-700">Could not load the history.</p>
      ) : entries.length === 0 ? (
        <p className="p-4 text-sm text-ink-500">Nothing recorded yet.</p>
      ) : (
        <ul>{entries.map((e) => <AuditEntryRow key={e.id} entry={e} compact />)}</ul>
      )}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          <span>Page {meta.current_page} of {meta.last_page} · {meta.total} entries</span>
          <span className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="font-semibold text-brand-700 disabled:opacity-40">Newer</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === meta.last_page} className="font-semibold text-brand-700 disabled:opacity-40">Older</button>
          </span>
        </div>
      )}
    </section>
  )
}

/** The History panel as a side drawer (Users, Stipend records). */
export function AuditHistoryDrawer({ scope, title, onClose }: { scope: AuditScope; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/30" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-ink-50 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <AuditHistory scope={scope} />
      </div>
    </div>
  )
}
