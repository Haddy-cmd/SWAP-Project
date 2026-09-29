'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Send } from 'lucide-react'
import { concernsApi } from '@/lib/api/concerns.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import { CONCERN_STATUS_META, type Concern, type ConcernStatus } from '@/types/concern.types'

const TABS: { key: ConcernStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

/** Concerns sent from the Help page. A reply notifies the sender in the portal and by email. */
export default function AdminConcernsPage() {
  const [tab, setTab] = useState<ConcernStatus | 'all'>('open')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-concerns', tab, page],
    queryFn: () => concernsApi.getInbox({ status: tab === 'all' ? undefined : tab, page }),
  })
  const concerns = data?.data ?? []
  const counts = data?.meta.counts ?? {}
  const lastPage = data?.meta.last_page ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Concerns</h1>
        <p className="mt-1 text-sm text-ink-500">Questions and problems users send from the Help page. Your reply reaches them in the portal and by email.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1) }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === t.key ? 'bg-brand-700 text-white' : 'border border-ink-200 bg-white text-ink-500 hover:bg-ink-50'}`}>
            {t.label}{t.key !== 'all' && counts[t.key] !== undefined ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-ink-200" />)}</div>
      ) : !concerns.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-200 bg-white py-16 text-center">
          <Inbox className="h-10 w-10 text-ink-300" />
          <p className="text-sm text-ink-350">Nothing here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {concerns.map((c) => <ConcernCard key={c.id} concern={c} />)}
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Previous</button>
          <span className="text-ink-500">Page {page} of {lastPage}</span>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}
            className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function ConcernCard({ concern: c }: { concern: Concern }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const update = useMutation({
    mutationFn: (v: { status: ConcernStatus; response?: string }) => concernsApi.update(c.id, v),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-concerns'] })
      setReply(''); setError(null); setNotice(res.message ?? 'Saved.')
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not save.'),
  })

  const meta = CONCERN_STATUS_META[c.status]
  const text = reply.trim()

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{c.subject}</p>
          <p className="text-xs text-ink-500">
            {c.user?.name ?? 'Unknown user'}{c.user?.role ? ` · ${c.user.role}` : ''}{c.user?.email ? ` · ${c.user.email}` : ''}
            {c.created_at && <> · {formatDateTime(c.created_at)}</>}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-ink-700">{c.message}</p>

      {c.response && (
        <div className="mt-3 rounded-lg border-l-4 border-brand-700 bg-brand-50 px-3 py-2">
          <p className="text-xs font-semibold text-brand-700">
            Reply{c.responded_by ? ` by ${c.responded_by}` : ''}{c.responded_at ? ` · ${formatDateTime(c.responded_at)}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-900">{c.response}</p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={2000}
          placeholder={c.response ? 'Send another reply…' : 'Write a reply to the user…'}
          className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
        {error && <p className="text-xs font-medium text-danger-700">{error}</p>}
        {notice && <p className="text-xs font-medium text-success-700">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setNotice(null); update.mutate({ status: 'resolved', response: text || undefined }) }}
            disabled={update.isPending || (!text && !c.response)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> {text ? 'Reply & resolve' : 'Mark resolved'}
          </button>
          {text && (
            <button onClick={() => { setNotice(null); update.mutate({ status: 'in_progress', response: text }) }} disabled={update.isPending}
              className="rounded-lg border border-ink-200 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-50">
              Reply, keep open
            </button>
          )}
          {c.status === 'open' && !text && (
            <button onClick={() => { setNotice(null); update.mutate({ status: 'in_progress' }) }} disabled={update.isPending}
              className="rounded-lg border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50">
              Mark in progress
            </button>
          )}
          {c.status === 'resolved' && !text && (
            <button onClick={() => { setNotice(null); update.mutate({ status: 'open' }) }} disabled={update.isPending}
              className="rounded-lg border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50">
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
