'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquareText, Send } from 'lucide-react'
import { concernsApi } from '@/lib/api/concerns.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { useUIStore } from '@/lib/store/uiStore'
import type { ApiRequestError } from '@/lib/api/axios'
import { CONCERN_STATUS_META, type Concern } from '@/types/concern.types'

/**
 * The SWAP Assistant's "Ask the DSA" tab: start a concern, then keep it as a running
 * conversation — follow-ups need no new subject until the DSA resolves it. Replies also
 * arrive as a notification and by email. Admins answer from Admin → Concerns.
 */
export function DsaConcernsPanel() {
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const draft = useUIStore((s) => s.dsaDraft)
  const setDsaDraft = useUIStore((s) => s.setDsaDraft)

  // A question the assistant couldn't answer arrives here prefilled (still editable).
  useEffect(() => {
    if (!draft) return
    setSubject(draft.subject)
    setMessage(draft.message)
    setSent(null)
    setError(null)
    setDsaDraft(null)
  }, [draft, setDsaDraft])

  const { data: concerns = [], isLoading } = useQuery({ queryKey: ['my-concerns'], queryFn: concernsApi.getMine })

  const submit = useMutation({
    mutationFn: () => concernsApi.submit({ subject: subject.trim(), message: message.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-concerns'] })
      setSubject(''); setMessage(''); setError(null)
      setSent(res.message ?? 'Your concern has been submitted.')
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not send your concern.'),
  })

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-5">
      <div>
        <p className="text-sm text-ink-600">
          Can&apos;t find the answer? Start a concern — you can keep replying in the same thread until the DSA resolves it. You&apos;ll get their replies here, in your notifications and by email.
        </p>
        <div className="mt-3 space-y-2.5">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} aria-label="Subject"
            placeholder="Subject, e.g. My Tuesday hours are missing" className={INPUT} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} aria-label="Message"
            placeholder="Describe what happened and what you need…" className={INPUT} />
          {error && <p className="text-xs text-danger-700">{error}</p>}
          {sent && <p className="text-xs font-medium text-success-700">{sent}</p>}
          <button onClick={() => { setError(null); setSent(null); submit.mutate() }}
            disabled={submit.isPending || !subject.trim() || message.trim().length < 10}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
            <Send className="h-4 w-4" /> {submit.isPending ? 'Sending…' : 'Send to the DSA Office'}
          </button>
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Mail className="h-3.5 w-3.5" /> Or email <a href="mailto:dsa@msumain.edu.ph" className="font-medium text-brand-700 underline">dsa@msumain.edu.ph</a>
          </p>
        </div>
      </div>

      <div className="border-t border-ink-100 pt-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-brand-700" />
          <h3 className="text-sm font-semibold text-ink-900">Your concerns</h3>
        </div>
        {isLoading ? (
          <div className="mt-3 space-y-2">{[1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-200" />)}</div>
        ) : !concerns.length ? (
          <p className="mt-3 text-xs text-ink-350">You haven&apos;t sent any concerns yet.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {concerns.map((c) => <ConcernThreadItem key={c.id} concern={c} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

/** One concern as a conversation, with an inline reply box until it is resolved. */
function ConcernThreadItem({ concern: c }: { concern: Concern }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: () => concernsApi.reply(c.id, reply.trim()),
    onSuccess: () => { setReply(''); setError(null); qc.invalidateQueries({ queryKey: ['my-concerns'] }) },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not send your reply.'),
  })

  // Backfilled/old shapes may lack `messages`; fall back to the opener + single reply.
  const thread = c.messages?.length
    ? c.messages
    : [
        { id: -1, from_staff: false, author: null, body: c.message, created_at: c.created_at },
        ...(c.response ? [{ id: -2, from_staff: true, author: c.responded_by ?? null, body: c.response, created_at: c.responded_at }] : []),
      ]
  const meta = CONCERN_STATUS_META[c.status]

  return (
    <li className="rounded-xl border border-ink-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{c.subject}</p>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="mt-2 space-y-2">
        {thread.map((m) => (
          <div key={m.id} className={m.from_staff ? 'flex justify-start' : 'flex justify-end'}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${m.from_staff ? 'border-l-4 border-brand-700 bg-brand-50' : 'bg-ink-100'}`}>
              <p className={`text-[11px] font-semibold ${m.from_staff ? 'text-brand-700' : 'text-ink-500'}`}>
                {m.from_staff ? 'DSA Office' : 'You'}{m.created_at ? ` · ${formatDateTime(m.created_at)}` : ''}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-ink-900">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      {c.status === 'resolved' ? (
        <p className="mt-2 text-[11px] text-ink-400">Resolved. Start a new concern above if you still need help.</p>
      ) : (
        <div className="mt-2.5 flex items-end gap-2">
          <textarea value={reply} onChange={(e) => { setReply(e.target.value); setError(null) }} rows={1} maxLength={2000}
            aria-label={`Reply to ${c.subject}`} placeholder="Reply…"
            className="min-h-[38px] flex-1 resize-none rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 text-xs focus:border-brand-700 focus:outline-none" />
          <button onClick={() => send.mutate()} disabled={send.isPending || reply.trim().length < 2}
            aria-label="Send reply"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white hover:bg-brand-600 disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-danger-700">{error}</p>}
    </li>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'
