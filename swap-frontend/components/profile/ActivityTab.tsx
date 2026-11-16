'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Activity, CalendarCheck, Clock, Download, FileText, Loader2, MapPin, MessageSquare, Settings, UserRound, Wallet,
} from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { CARD, timeAgo } from './ui'

const AREA_ICON: Record<string, { Icon: typeof Activity; bg: string; fg: string }> = {
  accounts: { Icon: UserRound, bg: 'var(--color-accent-soft)', fg: 'var(--text-accent-strong)' },
  hours: { Icon: Clock, bg: 'var(--color-brand-100)', fg: 'var(--text-brand-700)' },
  stipend: { Icon: Wallet, bg: 'var(--color-warning-50)', fg: 'var(--text-gold-600)' },
  terms: { Icon: FileText, bg: 'var(--color-violet-100)', fg: 'var(--text-violet-600)' },
  applications: { Icon: CalendarCheck, bg: 'var(--color-success-50)', fg: 'var(--text-success-600)' },
  placements: { Icon: MapPin, bg: 'var(--color-brand-100)', fg: 'var(--text-brand-700)' },
  communication: { Icon: MessageSquare, bg: 'var(--color-violet-100)', fg: 'var(--text-violet-600)' },
  exports: { Icon: Download, bg: 'var(--color-ink-100)', fg: 'var(--text-ink-600)' },
  settings: { Icon: Settings, bg: 'var(--color-ink-100)', fg: 'var(--text-ink-600)' },
}
const OTHER = { Icon: Activity, bg: 'var(--color-ink-100)', fg: 'var(--text-ink-600)' }

/** Profile → Activity: what you did yourself, newest first (from the audit trail). */
export function ActivityTab() {
  const q = useInfiniteQuery({
    queryKey: ['profile-activity'],
    queryFn: ({ pageParam }) => authApi.myActivity(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const items = q.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <section className={`${CARD} p-4 sm:p-6`}>
      <h2 className="text-[16px] font-bold text-ink-950">Recent activity</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-500">Things you did in the portal. Only you see this list.</p>

      {q.isLoading ? (
        <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-danger-700">Couldn&apos;t load your activity. Refresh to try again.</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Clock className="h-8 w-8 text-ink-350" />
          <p className="mt-2 text-sm text-ink-400">Nothing yet. Your changes and actions will show up here.</p>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-ink-900/[.06]">
            {items.map((a) => {
              const { Icon, bg, fg } = AREA_ICON[a.area] ?? OTHER
              return (
                <li key={a.id} className="flex items-center gap-3.5 py-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color: fg }}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] text-ink-800">{a.summary}</span>
                  <time dateTime={a.created_at} title={new Date(a.created_at).toLocaleString('en-PH')}
                    className="flex-none text-[12px] text-ink-400">{timeAgo(a.created_at)}</time>
                </li>
              )
            })}
          </ul>
          {q.hasNextPage && (
            <button type="button" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-ink-200 py-2.5 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-60">
              {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load more
            </button>
          )}
        </>
      )}
    </section>
  )
}
