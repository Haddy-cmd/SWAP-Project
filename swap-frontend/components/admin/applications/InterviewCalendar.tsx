'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarOff, ChevronLeft, ChevronRight, Users, Video } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatTime } from '@/lib/utils/formatDate'
import type { Application, Interview } from '@/types/application.types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Manila-local Y / M(0-based) / D for a timestamp, so days match the times shown everywhere else. */
function manilaYMD(iso: string | Date): { y: number; m0: number; d: number } {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m0: m - 1, d }
}

const pad = (n: number) => String(n).padStart(2, '0')

const modeStyle = (mode: Interview['mode']) =>
  mode === 'online'
    ? { label: 'Online', color: 'var(--text-violet-600)', bg: 'var(--color-violet-100)', dot: 'var(--color-violet-600)', Icon: Video }
    : { label: 'In person', color: 'var(--text-info-700)', bg: 'var(--color-info-50)', dot: 'var(--color-info-700)', Icon: Users }

type Item = { app: Application; iv: Interview; ts: number }

/**
 * Applications → Interview set → Calendar: one month of interviews (one request), a day's
 * interviews under the grid, and a click picks that application in the page's detail panel
 * (where Reschedule and No-show live). Replaces the old Admin → Interviews page.
 */
export function InterviewCalendar({ type, search, activeId, onSelect }: {
  type?: 'new' | 'renewal'
  search: string
  activeId: number | null
  onSelect: (applicationId: number) => void
}) {
  const today = useMemo(() => manilaYMD(new Date()), [])
  const [cursor, setCursor] = useState({ y: today.y, m: today.m0 })
  const [day, setDay] = useState<number | null>(null)
  const { y, m } = cursor
  const last = new Date(y, m + 1, 0).getDate()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications', 'calendar', y, m, type ?? 'all', search],
    queryFn: () => applicationsApi.adminListApplications({
      status: 'interview_scheduled', interview_from: `${y}-${pad(m + 1)}-01`, interview_to: `${y}-${pad(m + 1)}-${pad(last)}`,
      per_page: '200', ...(type && { type }), ...(search && { search }),
    }).then((r) => r.data),
  })

  // This month's interviews by Manila day, in time order (the server already sorts them).
  const byDay = useMemo(() => {
    const map = new Map<number, Item[]>()
    for (const app of data ?? []) {
      if (!app.interview) continue
      const at = manilaYMD(app.interview.scheduled_at)
      if (at.y !== y || at.m0 !== m) continue
      map.set(at.d, [...(map.get(at.d) ?? []), { app, iv: app.interview, ts: new Date(app.interview.scheduled_at).getTime() }])
    }
    for (const list of map.values()) list.sort((a, b) => a.ts - b.ts)
    return map
  }, [data, y, m])

  // Open on today when it has interviews, else the month's first day with any.
  useEffect(() => {
    if (day != null && byDay.has(day)) return
    const isThisMonth = y === today.y && m === today.m0
    setDay(isThisMonth && byDay.has(today.d) ? today.d : ([...byDay.keys()].sort((a, b) => a - b)[0] ?? null))
  }, [byDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const lead = new Date(y, m, 1).getDay()
  const cells = Array.from({ length: Math.ceil((lead + last) / 7) * 7 }, (_, i) => i - lead + 1)
  const total = [...byDay.values()].reduce((n, l) => n + l.length, 0)
  const items = day != null ? byDay.get(day) ?? [] : []
  const move = (delta: number) => { setDay(null); setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } }) }

  return (
    <div className="p-3.5">
      <div className="mb-3 flex items-center gap-1.5">
        <button type="button" onClick={() => move(-1)} aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 hover:text-accent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center leading-tight">
          <div className="text-[14px] font-bold text-ink-900">{MONTHS[m]} {y}</div>
          <div className="text-[11.5px] text-ink-500">{isLoading ? 'Loading…' : `${total} ${total === 1 ? 'interview' : 'interviews'}`}</div>
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 hover:text-accent">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => { setDay(null); setCursor({ y: today.y, m: today.m0 }) }}
          className="h-8 rounded-lg border border-ink-200 bg-surface px-2.5 text-[12px] font-semibold text-ink-700 hover:text-accent">Today</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WD.map((w) => <div key={w} className="pb-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{w}</div>)}
        {cells.map((d, i) => {
          if (d < 1 || d > last) return <div key={i} className="h-11 rounded-lg bg-ink-50/60" />
          const list = byDay.get(d) ?? []
          const isToday = y === today.y && m === today.m0 && d === today.d
          const on = d === day
          return (
            <button key={i} type="button" disabled={!list.length} onClick={() => setDay(d)} aria-pressed={on}
              aria-label={`${MONTHS[m]} ${d}: ${list.length} ${list.length === 1 ? 'interview' : 'interviews'}`}
              className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border text-[12.5px] transition-colors ${
                on ? 'border-accent bg-accent-tint font-bold text-accent-strong'
                  : list.length ? 'border-ink-200 bg-surface font-bold text-ink-800 hover:border-accent/50' : 'border-transparent text-ink-400'
              } ${isToday && !on ? 'ring-2 ring-inset ring-accent/60' : ''}`}>
              {d}
              {list.length > 0 && (
                <span className="flex gap-0.5">
                  {list.slice(0, 3).map((it) => <span key={it.app.id} className="h-1.5 w-1.5 rounded-full" style={{ background: modeStyle(it.iv.mode).dot }} />)}
                  {list.length > 3 && <span className="text-[9px] font-bold leading-none text-ink-500">+</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3 text-[11.5px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-info-700" />In person</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-600" />Online</span>
      </div>

      <div className="mt-3.5 border-t border-ink-900/[.06] pt-3">
        {!isLoading && total === 0 ? (
          <div className="py-6 text-center">
            <CalendarOff className="mx-auto h-8 w-8 text-ink-350" />
            <p className="mt-2 text-[13px] font-semibold text-ink-700">No interviews in {MONTHS[m]} {y}</p>
          </div>
        ) : day != null && (
          <>
            <p className="mb-2 text-[12px] font-bold text-ink-700">{WD_LONG[new Date(y, m, day).getDay()]}, {MONTHS[m]} {day}</p>
            <ul className="space-y-1.5">
              {items.map((it) => {
                const ms = modeStyle(it.iv.mode)
                const on = it.app.id === activeId
                return (
                  <li key={it.app.id}>
                    <button type="button" onClick={() => onSelect(it.app.id)} aria-current={on}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                        on ? 'border-accent bg-accent-tint' : 'border-ink-900/[.08] hover:bg-ink-50/70'}`}>
                      <span className="w-[58px] flex-none text-[12px] font-bold text-accent-strong">{formatTime(it.iv.scheduled_at)}</span>
                      <UserAvatar name={it.app.user?.name} avatarUrl={it.app.user?.avatar_url} className="h-8 w-8 flex-none rounded-full bg-accent-soft text-[11.5px] font-bold" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-900">{it.app.user?.name ?? '—'}</span>
                      {it.iv.status === 'no_show' && (
                        <span className="flex-none rounded-full bg-gold-50 px-2 py-0.5 text-[10.5px] font-bold text-warning-700 ring-1 ring-gold-200">No-show</span>
                      )}
                      <span className="flex flex-none items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11px] font-semibold" style={{ color: ms.color, background: ms.bg }}>
                        <ms.Icon className="h-3.5 w-3.5" />{ms.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
