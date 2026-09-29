'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Send, MessageSquareText, Mail } from 'lucide-react'
import { concernsApi } from '@/lib/api/concerns.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import { CONCERN_STATUS_META } from '@/types/concern.types'

/**
 * Help: write to the DSA Office and read their replies. Replies also arrive as a
 * notification and by email. (The chatbot answers common questions; this is for
 * anything that needs a person.)
 */
export default function HelpPage() {
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Help</h1>
        <p className="mt-1 text-sm text-ink-500">
          Can&apos;t find the answer with the SWAP Assistant? Write to the DSA Office here. You&apos;ll get their reply in the portal and by email.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="h-fit rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">Send a concern</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-ink-700">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255}
                placeholder="e.g. My Tuesday hours are missing" className={`${INPUT} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-700">Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={2000}
                placeholder="Describe what happened and what you need…" className={`${INPUT} mt-1`} />
            </label>
            {error && <p className="text-sm text-danger-700">{error}</p>}
            {sent && <p className="text-sm font-medium text-success-700">{sent}</p>}
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

        <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">Your concerns</h2>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-3">{[1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-ink-200" />)}</div>
          ) : !concerns.length ? (
            <p className="mt-4 text-sm text-ink-350">You haven&apos;t sent any concerns yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {concerns.map((c) => (
                <li key={c.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-ink-900">{c.subject}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONCERN_STATUS_META[c.status].cls}`}>
                      {CONCERN_STATUS_META[c.status].label}
                    </span>
                  </div>
                  {c.created_at && <p className="text-xs text-ink-350">Sent {formatDateTime(c.created_at)}</p>}
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{c.message}</p>
                  {c.response && (
                    <div className="mt-3 rounded-lg border-l-4 border-brand-700 bg-brand-50 px-3 py-2">
                      <p className="text-xs font-semibold text-brand-700">
                        DSA Office{c.responded_at ? ` · ${formatDateTime(c.responded_at)}` : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink-900">{c.response}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'
