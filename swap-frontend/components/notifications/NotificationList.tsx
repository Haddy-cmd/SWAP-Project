'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { CheckCheck, ChevronRight, CircleCheckBig, Inbox, Loader2 } from 'lucide-react'
import { notificationsApi } from '@/lib/api/notifications.api'
import { useAuthStore } from '@/lib/store/authStore'
import { notificationLink } from '@/lib/utils/notificationLink'
import { KIND_ORDER, iconFor, kindInfo, kindOf, whoWhat, type KindKey } from '@/lib/utils/notificationKind'
import { AnnouncementModal } from './AnnouncementModal'
import type { Notification } from '@/types/notification.types'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const PER_PAGE = 30
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** "Today", "Yesterday", "3 days ago", then "Sep 30". */
function when(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return `Today · ${formatDistanceToNowStrict(d, { addSuffix: true })}`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

/** The Notifications page (every role): filter by kind, unread only, This week / Earlier. */
export function NotificationList() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const [kind, setKind] = useState<KindKey | 'all'>('all')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [announcement, setAnnouncement] = useState<Notification | null>(null)

  const q = useInfiniteQuery({
    queryKey: ['notifications', 'page'],
    queryFn: ({ pageParam }) => notificationsApi.getNotifications(pageParam, PER_PAGE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const all = q.data?.pages.flatMap((p) => p.data) ?? []
  const unread = q.data?.pages[0]?.meta.unread_count ?? all.filter((n) => !n.is_read).length

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.markAsRead(id), onSuccess: refresh })
  const markAll = useMutation({ mutationFn: () => notificationsApi.markAllAsRead(), onSuccess: refresh })

  // Clicking marks it read, then opens the announcement popup or the related page.
  const open = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.data.type === 'announcement') return setAnnouncement(n)
    const href = notificationLink(n, role)
    if (href) router.push(href)
  }

  const base = onlyUnread ? all.filter((n) => !n.is_read) : all
  const counts = new Map<KindKey, number>()
  for (const n of base) counts.set(kindOf(n).key, (counts.get(kindOf(n).key) ?? 0) + 1)
  const present = KIND_ORDER.filter((k) => all.some((n) => kindOf(n).key === k))
  const shown = kind === 'all' ? base : base.filter((n) => kindOf(n).key === kind)
  const cutoff = Date.now() - WEEK_MS
  const groups = [
    { label: 'This week', items: shown.filter((n) => new Date(n.created_at).getTime() >= cutoff) },
    { label: 'Earlier', items: shown.filter((n) => new Date(n.created_at).getTime() < cutoff) },
  ].filter((g) => g.items.length)

  const chip = (key: KindKey | 'all', label: string, Icon: typeof Inbox, count: number) => {
    const on = kind === key
    return (
      <button key={key} type="button" onClick={() => setKind(key)} aria-pressed={on}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-[13px] text-[13px] font-semibold transition-colors ${
          on ? 'border-accent-deep bg-accent-deep text-white' : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300'}`}>
        <Icon className="h-[17px] w-[17px]" /> {label}
        <span className="text-[11.5px] font-bold opacity-70">{count}</span>
      </button>
    )
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink-950">Notifications</h1>
          <p className="mt-1 text-[14px] text-ink-500">{q.isLoading ? 'Loading…' : unread ? `${unread} unread · newest first` : 'All read'}</p>
        </div>
        <button type="button" onClick={() => markAll.mutate()} disabled={!unread || markAll.isPending}
          className="flex h-10 items-center gap-[7px] rounded-[11px] border border-ink-200 bg-surface px-[15px] text-[13px] font-semibold text-ink-900 transition-colors hover:border-accent disabled:cursor-default disabled:text-ink-350 disabled:hover:border-ink-200">
          {markAll.isPending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <CheckCheck className="h-[18px] w-[18px]" />} Mark all as read
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 sm:flex-wrap">
          {chip('all', 'All', Inbox, base.length)}
          {present.map((k) => { const info = kindInfo(k); return chip(k, info.label, info.Icon, counts.get(k) ?? 0) })}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-600">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Unread only
        </label>
      </div>

      {q.isLoading ? (
        <div className={`${CARD} space-y-px overflow-hidden`}>{[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse bg-ink-50" />)}</div>
      ) : groups.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center gap-2 px-5 py-14 text-center`}>
          <CircleCheckBig className="h-9 w-9 text-accent-bright" />
          <p className="text-[16px] font-bold text-ink-950">You&apos;re all caught up</p>
          <p className="text-[13.5px] text-ink-500">{all.length === 0 ? 'You have no notifications yet.' : 'Nothing here matches this filter.'}</p>
        </div>
      ) : groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-2">
          <h2 className="px-1 pt-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-400">{g.label}</h2>
          <div className={`stagger ${CARD} overflow-hidden`}>
            {g.items.map((n) => {
              const k = kindOf(n)
              const Icon = iconFor(n, k)
              const { who, what, inline } = whoWhat(n)
              const isUnread = !n.is_read
              const href = notificationLink(n, role)
              const cta = n.data.type === 'announcement' ? 'Read' : href ? (role === 'admin' && (k.key === 'applications' || k.key === 'renewals') ? 'Review' : 'Open') : null
              const note = typeof n.data.note === 'string' && n.data.note ? n.data.note : null
              return (
                <button key={n.id} type="button" onClick={() => open(n)}
                  className={`flex w-full items-start gap-3.5 border-b border-ink-900/[.05] px-4 py-4 text-left transition-colors last:border-0 hover:bg-ink-50 sm:px-5 ${isUnread ? 'bg-accent-tint/40' : ''}`}>
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    {inline ? (
                      <span className="block break-words text-[14px] leading-[1.45] text-ink-900"><strong className="font-bold">{who}</strong> {what}</span>
                    ) : (
                      <>
                        <span className={`block break-words text-[14px] leading-[1.45] ${isUnread ? 'font-bold text-ink-950' : 'font-semibold text-ink-800'}`}>{who}</span>
                        {what && <span className="mt-0.5 block whitespace-pre-line break-words text-[13px] leading-[1.45] text-ink-600">{what}</span>}
                      </>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-400">
                      <span>{k.one}</span><span aria-hidden>·</span><span>{when(n.created_at)}</span>
                      {note && <span className="rounded-full bg-gold-50 px-2 py-px font-semibold text-warning-700">{note}</span>}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-2.5 self-center">
                    {cta && <span className="hidden items-center gap-0.5 text-[12.5px] font-bold text-accent-strong sm:flex">{cta}<ChevronRight className="h-4 w-4" /></span>}
                    <span className={`h-[9px] w-[9px] rounded-full ${isUnread ? 'bg-accent' : 'bg-transparent'}`} aria-label={isUnread ? 'Unread' : undefined} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {q.hasNextPage && (
        <button type="button" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}
          className="mx-auto flex h-10 items-center gap-2 rounded-[11px] border border-ink-200 bg-surface px-5 text-[13px] font-semibold text-ink-700 hover:border-accent disabled:opacity-60">
          {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load more
        </button>
      )}

      {announcement && <AnnouncementModal notification={announcement} onClose={() => setAnnouncement(null)} />}
    </div>
  )
}
