'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, Loader2, CircleDot, CheckCircle2, Undo2, Send, ArrowLeft, MessagesSquare } from 'lucide-react'
import { concernsApi } from '@/lib/api/concerns.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { Concern, ConcernMessage, ConcernStatus } from '@/types/concern.types'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const GREEN = 'var(--color-accent)'
const MAX = 2000

type Tab = ConcernStatus | 'all'
const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]
const STATUS: Record<ConcernStatus, { label: string; fg: string; bg: string }> = {
  open: { label: 'Open', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)' },
  in_progress: { label: 'In progress', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' },
  resolved: { label: 'Resolved', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
}
const ROLE: Record<string, { label: string; fg: string; bg: string }> = {
  recipient: { label: 'Recipient', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  applicant: { label: 'Applicant', fg: 'var(--text-violet-600)', bg: 'var(--color-violet-100)' },
  supervisor: { label: 'Supervisor', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' },
  admin: { label: 'Admin', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)' },
}

const initials = (name?: string | null) =>
  (name ?? '?').replace(/^(Prof\.|Dr\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
const firstName = (name?: string | null) => (name ?? 'there').replace(/^(Prof\.|Dr\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(/\s+/)[0]

/** "5:53 PM" today, "Yesterday", else "Jun 12". */
function ago(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(new Date()) - day(d)) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}

/** The conversation, oldest first (older concerns may only have the opener + one reply). */
function threadOf(c: Concern): ConcernMessage[] {
  if (c.messages?.length) return c.messages
  return [
    { id: -1, from_staff: false, author: c.user?.name ?? null, body: c.message, created_at: c.created_at },
    ...(c.response ? [{ id: -2, from_staff: true, author: c.responded_by ?? null, body: c.response, created_at: c.responded_at }] : []),
  ]
}

/**
 * Admin → Concerns (layout "SWAP Admin Concerns v2"): what users send from the SWAP Assistant,
 * as an inbox. The red dot marks a concern whose sender wrote last and is waiting for the DSA.
 * A reply reaches them in the portal and by email; resolving needs a reply first, so they
 * always learn the outcome.
 */
export default function AdminConcernsPage() {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showThread, setShowThread] = useState(false) // phones: list or conversation
  const [reply, setReply] = useState('')
  const [resolveOnSend, setResolveOnSend] = useState(false)
  const threadEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const inbox = useInfiniteQuery({
    queryKey: ['admin-concerns', tab, q],
    queryFn: ({ pageParam }) => concernsApi.getInbox({ status: tab === 'all' ? undefined : tab, page: pageParam, search: q }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const concerns = inbox.data?.pages.flatMap((p) => p.data) ?? []
  const counts = inbox.data?.pages[0]?.meta.counts ?? {}
  const countOf = (k: Tab) => (k === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[k] ?? 0)

  const sel = concerns.find((c) => c.id === selectedId) ?? concerns[0] ?? null
  const thread = sel ? threadOf(sel) : []
  const hasReply = thread.some((m) => m.from_staff)

  // A fresh draft for each concern; keep the newest message in view.
  useEffect(() => { setReply(''); setResolveOnSend(false) }, [sel?.id])
  useEffect(() => { threadEnd.current?.scrollIntoView({ block: 'nearest' }) }, [sel?.id, thread.length])

  const save = useMutation({
    mutationFn: (v: { status: ConcernStatus; response?: string }) => concernsApi.update(sel!.id, v),
    onSuccess: (res, v) => {
      qc.invalidateQueries({ queryKey: ['admin-concerns'] })
      // Stay on this concern even if it leaves the current tab.
      if (v.status !== sel?.status && tab !== 'all') setTab(v.status)
      setSelectedId(res.data.id)
      const who = firstName(sel?.user?.name)
      if (v.response) {
        setReply(''); setResolveOnSend(false)
        notify({ title: `Reply sent to ${who}${v.status === 'resolved' ? ' · marked resolved' : ''}`, detail: 'They get it in the portal and by email.' })
      } else {
        notify({ title: v.status === 'resolved' ? 'Marked resolved' : v.status === 'open' ? 'Concern reopened' : 'Marked in progress', detail: null })
      }
    },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not save'),
  })

  const send = () => {
    const text = reply.trim()
    if (!sel || !text) return
    const status: ConcernStatus = resolveOnSend ? 'resolved' : sel.status === 'open' ? 'in_progress' : sel.status
    save.mutate({ status, response: text })
  }

  const first = firstName(sel?.user?.name)
  const quick: [string, string][] = [
    ['Checking it now', `Hi ${first}, thanks for reaching out. We're checking this now and will get back to you within the day.`],
    ['Please send details', `Hi ${first}, could you send a screenshot or more details so we can look into this?`],
    ['Fixed', `Hi ${first}, this has been fixed. Please refresh your portal and let us know if you still see the problem.`],
  ]

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Concerns</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">Questions sent through the SWAP Assistant. Your reply reaches them in the portal and by email.</p>
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
        {/* ── Inbox ── */}
        <div className={`${CARD} overflow-hidden ${showThread ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-col gap-2.5 border-b border-ink-900/[.05] p-3.5">
            <div className="flex h-[42px] items-center gap-2.5 rounded-xl bg-surface-2 px-3">
              <Search className="h-5 w-5 text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID or message" aria-label="Search concerns"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-ink-950 focus:outline-none" />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700"><X className="h-4 w-4" /></button>}
            </div>
            <div role="tablist" className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-surface-3 p-[3px]">
              {TABS.map((t) => {
                const on = tab === t.key
                return (
                  <button key={t.key} role="tab" aria-selected={on} onClick={() => { setTab(t.key); setSelectedId(null) }}
                    className={`flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[9px] text-xs font-semibold transition-colors ${
                      on ? 'bg-surface text-ink-950 shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-500 hover:text-ink-800'}`}>
                    {t.label}<span className="font-extrabold">{countOf(t.key)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="max-h-[640px] overflow-auto">
            {inbox.isLoading ? (
              <div className="space-y-2 p-3.5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[74px] animate-pulse rounded-xl bg-ink-100" />)}</div>
            ) : concerns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong"><CheckCircle2 className="h-6 w-6" /></span>
                <p className="text-[14px] font-semibold">{q ? 'No matches' : tab === 'open' ? 'All caught up' : 'Nothing here'}</p>
                <p className="text-[12.5px] text-ink-500">{q ? 'Try a different word.' : tab === 'open' ? 'No open concerns right now.' : 'Concerns will show here when their status changes.'}</p>
              </div>
            ) : (
              <>
                {concerns.map((c) => {
                  const on = c.id === sel?.id
                  const msgs = threadOf(c)
                  const last = msgs[msgs.length - 1]
                  const st = STATUS[c.status]
                  return (
                    <button key={c.id} onClick={() => { setSelectedId(c.id); setShowThread(true) }} aria-current={on}
                      className={`flex w-full gap-3 border-b border-ink-900/[.04] px-4 py-3.5 text-left transition-colors ${on ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'bg-surface hover:bg-surface-2'}`}>
                      <span className="relative flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                        style={on ? { background: 'var(--color-accent-deep)', color: '#fff' } : { background: 'var(--color-brand-100)', color: 'var(--text-accent-deep)' }}>
                        {initials(c.user?.name)}
                        {c.waiting_on_staff && <span className="absolute -right-px -top-px h-2.5 w-2.5 rounded-full border-2 border-white bg-red-accent" title="Waiting for your reply" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`min-w-0 flex-1 truncate text-[14px] ${c.waiting_on_staff ? 'font-extrabold' : 'font-semibold'}`}>{c.user?.name ?? 'Unknown user'}</span>
                          <span className="flex-none text-[11.5px] text-ink-400">{ago(c.last_message_at ?? last?.created_at ?? c.created_at)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink-700">{c.subject}</span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">{last?.from_staff ? 'You: ' : ''}{last?.body}</span>
                          <span className="flex-none rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
                {inbox.hasNextPage && (
                  <button onClick={() => inbox.fetchNextPage()} disabled={inbox.isFetchingNextPage}
                    className="flex w-full items-center justify-center gap-2 py-3 text-[13px] font-semibold text-accent hover:bg-surface-2">
                    {inbox.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load more
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Conversation ── */}
        {sel ? (
          <div className={`${CARD} flex flex-col overflow-hidden ${showThread ? '' : 'hidden lg:flex'}`}>
            <div className="flex flex-wrap items-center gap-3.5 border-b border-ink-900/[.05] px-[22px] py-[18px]">
              <button onClick={() => setShowThread(false)} className="flex items-center gap-1 text-[13px] font-semibold text-accent lg:hidden">
                <ArrowLeft className="h-4 w-4" /> Back to list
              </button>
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent-deep text-[15px] font-bold text-white">{initials(sel.user?.name)}</span>
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[18px] font-extrabold">{sel.subject}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ color: STATUS[sel.status].fg, background: STATUS[sel.status].bg }}>{STATUS[sel.status].label}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-500">
                  <strong className="font-semibold text-ink-950">{sel.user?.name ?? 'Unknown user'}</strong>
                  {(sel.user?.student_id_number || sel.user?.employee_id) && <><span>·</span><span>ID {sel.user?.student_id_number ?? sel.user?.employee_id}</span></>}
                  {sel.user?.role && ROLE[sel.user.role] && (
                    <span className="rounded-md px-1.5 py-px text-[11px] font-bold" style={{ color: ROLE[sel.user.role].fg, background: ROLE[sel.user.role].bg }}>{ROLE[sel.user.role].label}</span>
                  )}
                  {sel.user?.email && <><span>·</span><span className="break-all">{sel.user.email}</span></>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sel.status === 'open' && (
                  <button onClick={() => save.mutate({ status: 'in_progress' })} disabled={save.isPending}
                    className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[13px] font-semibold text-info-700 hover:border-info-700 disabled:opacity-50">
                    <CircleDot className="h-4 w-4" /> Mark in progress
                  </button>
                )}
                {sel.status !== 'resolved' && (
                  <button onClick={() => save.mutate({ status: 'resolved' })} disabled={save.isPending || !hasReply}
                    title={hasReply ? undefined : 'Reply first so they know the outcome'}
                    className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[13px] font-semibold text-accent-strong hover:border-accent disabled:cursor-not-allowed disabled:opacity-45">
                    <CheckCircle2 className="h-4 w-4" /> Mark resolved
                  </button>
                )}
                {sel.status === 'resolved' && (
                  <button onClick={() => save.mutate({ status: 'open' })} disabled={save.isPending}
                    className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[13px] font-semibold text-gold-700 hover:border-gold-accent disabled:opacity-50">
                    <Undo2 className="h-4 w-4" /> Reopen
                  </button>
                )}
              </div>
            </div>

            <div className="flex max-h-[60dvh] min-h-[240px] flex-col gap-3.5 overflow-auto bg-surface-2 p-3.5 sm:max-h-[460px] sm:min-h-[300px] sm:p-[22px]">
              {thread.map((m) => (
                <div key={m.id} className={`flex flex-col gap-1 ${m.from_staff ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11.5px] text-ink-500">
                    <span className="font-semibold text-ink-700">{m.from_staff ? (m.author ? `DSA · ${m.author}` : 'DSA Office') : (sel.user?.name ?? 'User')}</span>
                    {m.created_at ? ` · ${formatDateTime(m.created_at)}` : ''}
                  </span>
                  <div className={`max-w-[85%] whitespace-pre-wrap border px-[15px] py-3 text-[14px] leading-relaxed sm:max-w-[72%] ${
                    m.from_staff ? 'rounded-[16px_16px_4px_16px] border-accent bg-accent text-white' : 'rounded-[16px_16px_16px_4px] border-ink-200 bg-surface text-ink-950'}`}>
                    {m.body}
                  </div>
                </div>
              ))}
              {sel.status === 'resolved' && (
                <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-accent-strong"><CheckCircle2 className="h-4 w-4" /> Marked resolved</p>
              )}
              <div ref={threadEnd} />
            </div>

            <div className="flex flex-col gap-2.5 border-t border-ink-900/[.05] px-[22px] pb-[18px] pt-4">
              <div className="flex flex-wrap gap-1.5">
                {quick.map(([label, text]) => (
                  <button key={label} onClick={() => setReply(text)}
                    className="h-[30px] rounded-full border border-ink-200 bg-surface px-3 text-xs font-semibold text-ink-600 hover:border-accent hover:bg-accent-tint hover:text-accent-strong">{label}</button>
                ))}
              </div>
              <div className="flex items-end gap-2.5 rounded-[14px] border border-ink-200 bg-surface py-2 pl-3.5 pr-2 focus-within:border-accent">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={MAX}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
                  placeholder={`Write a reply to ${first}…`} aria-label="Reply"
                  className="min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-[14px] leading-normal text-ink-950 focus:outline-none" />
                <button onClick={send} disabled={!reply.trim() || save.isPending} aria-label="Send reply"
                  className="flex h-10 flex-none items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-bold text-white disabled:cursor-not-allowed sm:px-4"
                  style={{ background: reply.trim() && !save.isPending ? GREEN : 'var(--color-accent-muted)' }}>
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="hidden sm:inline">Send reply</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600">
                  <input type="checkbox" checked={resolveOnSend} onChange={(e) => setResolveOnSend(e.target.checked)} className="h-4 w-4 accent-accent" />
                  Mark resolved after sending
                </label>
                {!hasReply && sel.status !== 'resolved' && <span className="text-xs text-ink-500">Reply first so they know the outcome, then you can resolve it.</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className={`${CARD} hidden flex-col items-center justify-center gap-2 px-6 py-20 text-center lg:flex`}>
            <MessagesSquare className="h-9 w-9 text-ink-300" />
            <p className="text-[14px] font-semibold text-ink-700">Pick a concern to read it</p>
          </div>
        )}
      </div>
    </div>
  )
}
