'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, CheckCircle2 } from 'lucide-react'
import { analyticsApi } from '@/lib/api/analytics.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { BUSY_DAYS, BUSY_PENDING, GOLD, GREEN, Card, Labeled, Seg, Skeleton, isBusy, plural, useAnalytics, type TabProps } from './shared'

const initials = (name: string) =>
  name.replace(/^(Prof\.|Dr\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()

/**
 * Supervisors: the hour logs waiting for each supervisor this term. "Busy" = 10+ logs waiting
 * or the oldest waiting 3+ days (the backend's rule); "Remind busy supervisors" emails them,
 * at most once a day each.
 */
export function SupervisorsTab({ academicYear, semester }: TabProps) {
  const { insights, loading } = useAnalytics(academicYear, semester)
  const { notify, notifyError, confirm } = useFeedback()
  const [show, setShow] = useState<'all' | 'busy' | 'ok'>('all')
  const [sort, setSort] = useState<'most' | 'least'>('most')

  const remind = useMutation({
    mutationFn: () => analyticsApi.remindSupervisors(academicYear, semester),
    onSuccess: (r) => notify(r.reminded > 0
      ? { title: `Reminded ${plural(r.reminded, 'supervisor', 'supervisors')}`, detail: `They got a bell notification and an email.${r.already_today ? ` ${plural(r.already_today, 'was', 'were')} already reminded today.` : ''}` }
      : { tone: 'info', title: 'Nobody to remind', detail: r.already_today ? 'The busy supervisors were already reminded today.' : 'No supervisor is busy right now.' }),
    onError: (e) => notifyError(e, 'Could not send the reminders'),
  })

  if (loading && !insights) return <Skeleton h="h-96" />

  const all = (insights?.workload ?? []).filter((w) => w.pending > 0)
  const total = all.reduce((s, w) => s + w.pending, 0)
  const oldest = Math.max(0, ...all.map((w) => w.oldest_pending_days ?? 0))
  const busy = all.filter((w) => isBusy(w.pending, w.oldest_pending_days))
  const max = Math.max(1, ...all.map((w) => w.pending))
  const rows = all
    .filter((w) => show === 'all' || (show === 'busy') === isBusy(w.pending, w.oldest_pending_days))
    .sort((x, y) => (sort === 'least' ? x.pending - y.pending : y.pending - x.pending))

  const ask = async () => {
    const ok = await confirm({
      title: `Remind ${plural(busy.length, 'busy supervisor', 'busy supervisors')}?`,
      body: `They get a bell notification and an email about the hour logs waiting for them. Each supervisor is reminded at most once a day.`,
      confirmLabel: 'Send reminders',
    })
    if (ok) remind.mutate()
  }

  return (
    <Card title="Hour logs waiting for supervisors"
      hint={total ? `${plural(total, 'log', 'logs')} in total${oldest ? ` · the oldest has waited ${plural(oldest, 'day', 'days')}` : ''}` : 'No hour logs are waiting for verification.'}
      right={
        <button onClick={ask} disabled={busy.length === 0 || remind.isPending}
          title={busy.length === 0 ? 'No supervisor is busy right now' : undefined}
          className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-ink-200 bg-white px-3.5 text-[13px] font-semibold text-[#0B5234] hover:border-[#17815F] disabled:opacity-45">
          <Send className="h-[18px] w-[18px]" /> {remind.isPending ? 'Sending…' : 'Remind busy supervisors'}
        </button>
      }>
      {all.length === 0 ? (
        <p className="mt-5 flex items-center gap-2.5 rounded-[14px] bg-[#F6F7F3] px-4 py-3.5 text-[13.5px] text-ink-600">
          <CheckCircle2 className="h-5 w-5 text-[#17815F]" /> Every supervisor is on top of their verifications.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3.5">
            <Labeled label="Show">
              <Seg label="Show" value={show} onChange={setShow} options={[['all', 'All'], ['busy', 'Busy'], ['ok', 'On top of it']] as const} />
            </Labeled>
            <Labeled label="Sort">
              <Seg label="Sort" value={sort} onChange={setSort} options={[['most', 'Most waiting'], ['least', 'Fewest']] as const} />
            </Labeled>
            <span className="text-xs text-ink-500">Busy = {BUSY_PENDING}+ logs waiting, or one waiting {BUSY_DAYS}+ days</span>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {rows.length === 0 && <p className="py-4 text-center text-[13px] text-ink-500">No supervisor in this group.</p>}
            {rows.map((s) => {
              const b = isBusy(s.pending, s.oldest_pending_days)
              return (
                <div key={s.supervisor_id} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(150px,220px)_minmax(0,1fr)_120px]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#E7EFE9] text-[11px] font-bold text-[#063D27]">{initials(s.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
                      {s.oldest_pending_days != null && <span className="block text-[11px] text-ink-500">oldest {plural(s.oldest_pending_days, 'day', 'days')}</span>}
                    </span>
                  </div>
                  <div className="order-3 col-span-2 flex items-center gap-2.5 sm:order-none sm:col-span-1">
                    <div className="h-3 flex-1 rounded-md bg-[#EEF1EC]">
                      <div className="h-full rounded-md" style={{ width: `${(s.pending / max) * 100}%`, background: b ? GOLD : GREEN }} />
                    </div>
                    <strong className="w-8 text-[13.5px]">{s.pending}</strong>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-center text-xs font-bold"
                    style={b ? { color: '#7A5E00', background: '#FBF1C7' } : { color: '#0B5234', background: '#DFF0E7' }}>
                    {b ? 'Busy' : 'On top of it'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
