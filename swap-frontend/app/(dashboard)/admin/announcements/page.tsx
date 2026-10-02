'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Send, Mail, Users, Trash2 } from 'lucide-react'
import { announcementsApi } from '@/lib/api/announcements.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'

const MAX = 5000

/**
 * Admin → Announcements: one message to every active recipient. It lands in their
 * portal notifications and in their email inbox; the history below keeps what was sent.
 * Deleting one removes it from the history and from recipients' notifications (an
 * email already delivered can't be recalled, and the confirmation says so).
 */
export default function AdminAnnouncementsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [historyNote, setHistoryNote] = useState<{ text: string; error?: boolean } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-announcements', page],
    queryFn: () => announcementsApi.list(page),
  })
  const history = data?.data ?? []
  const audience = data?.meta.active_recipients
  const lastPage = data?.meta.last_page ?? 1

  const send = useMutation({
    mutationFn: () => announcementsApi.send({ title: title.trim(), message: message.trim() }),
    onSuccess: (res) => {
      // Show it at the top of the history right away; the refetch confirms it.
      qc.setQueryData<Awaited<ReturnType<typeof announcementsApi.list>>>(['admin-announcements', 1],
        (old) => old && { ...old, data: [res.data, ...old.data] })
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
      setTitle(''); setMessage(''); setConfirming(false); setError(null); setPage(1)
      setSent(res.message ?? 'Announcement sent.')
    },
    onError: (e: ApiRequestError) => {
      setConfirming(false)
      setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not send the announcement.')
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => announcementsApi.remove(id),
    onSuccess: (res, id) => {
      qc.setQueryData<Awaited<ReturnType<typeof announcementsApi.list>>>(['admin-announcements', page],
        (old) => old && { ...old, data: old.data.filter((a) => a.id !== id) })
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
      setDeletingId(null)
      setHistoryNote({ text: res.message })
    },
    onError: (e: ApiRequestError) => {
      setDeletingId(null)
      setHistoryNote({ text: e.message ?? 'Could not delete the announcement.', error: true })
    },
  })

  const ready = title.trim().length > 0 && message.trim().length >= 10 && !!audience

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Announcements</h1>
        <p className="mt-1 text-sm text-ink-500">
          Send a message to every active recipient. It appears in their portal notifications and is emailed to them.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">New announcement</h2>
          </div>
          {audience !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Users className="h-3.5 w-3.5" /> {audience} active recipient{audience === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-700">Title</span>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setConfirming(false) }} maxLength={150}
              placeholder="e.g. Stipend release schedule" className={`${INPUT} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-700">Message</span>
            <textarea value={message} onChange={(e) => { setMessage(e.target.value); setConfirming(false) }} rows={8} maxLength={MAX}
              placeholder="Write the announcement. Leave a blank line between paragraphs." className={`${INPUT} mt-1`} />
            <span className="mt-1 block text-right text-[11px] text-ink-350">{message.length.toLocaleString()} / {MAX.toLocaleString()}</span>
          </label>

          {error && <p className="text-sm text-danger-700">{error}</p>}
          {sent && <p className="text-sm font-medium text-success-700">{sent}</p>}
          {audience === 0 && <p className="text-sm text-warning-700">There are no active recipients to send an announcement to yet.</p>}

          {!confirming ? (
            <button onClick={() => { setError(null); setSent(null); setConfirming(true) }} disabled={!ready}
              className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              <Send className="h-4 w-4" /> Send announcement
            </button>
          ) : (
            // Emails can't be recalled: one explicit confirmation before sending.
            <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
              <p className="text-sm font-medium text-warning-800">
                Send &ldquo;{title.trim()}&rdquo; to {audience} active recipient{audience === 1 ? '' : 's'}? They get it in the portal and by email, and it can&apos;t be unsent.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => send.mutate()} disabled={send.isPending}
                  className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> {send.isPending ? 'Sending…' : 'Yes, send it'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={send.isPending}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Sent announcements</h2>
          {historyNote && (
            <p className={`mt-1 text-xs font-medium ${historyNote.error ? 'text-danger-700' : 'text-success-700'}`}>{historyNote.text}</p>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">{[1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-200" />)}</div>
        ) : !history.length ? (
          <p className="px-5 py-8 text-center text-sm text-ink-350">No announcements sent yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {history.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-ink-900">{a.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-350">{a.created_at ? formatDateTime(a.created_at) : ''}</span>
                    {deletingId !== a.id && (
                      <button onClick={() => { setHistoryNote(null); setDeletingId(a.id) }} title="Delete" aria-label={`Delete ${a.title}`}
                        className="rounded-lg border border-ink-200 p-1.5 text-danger-700 hover:bg-danger-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {deletingId === a.id && (
                  <div className="mt-2 rounded-xl border border-danger-200 bg-danger-50 p-3">
                    <p className="text-sm text-danger-700">
                      Delete this announcement? It disappears from the history and from the notifications of {a.recipient_count} recipient{a.recipient_count === 1 ? '' : 's'}. Emails already sent can&apos;t be recalled.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => remove.mutate(a.id)} disabled={remove.isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-danger-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> {remove.isPending ? 'Deleting…' : 'Yes, delete it'}
                      </button>
                      <button onClick={() => setDeletingId(null)} disabled={remove.isPending}
                        className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
                    </div>
                  </div>
                )}
                <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{a.message}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {a.recipient_count} recipient{a.recipient_count === 1 ? '' : 's'}</span>
                  <span className={`inline-flex items-center gap-1 ${a.emailed_count < a.recipient_count ? 'font-semibold text-warning-700' : ''}`}>
                    <Mail className="h-3.5 w-3.5" /> {a.emailed_count} emailed
                  </span>
                  {a.sent_by && <span>by {a.sent_by}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-ink-100 py-3 text-sm">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Previous</button>
            <span className="text-ink-500">Page {page} of {lastPage}</span>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}
              className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'
