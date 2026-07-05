'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Video, Users, FileText, X, CalendarOff,
} from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatTime } from '@/lib/utils/formatDate'
import type { Application, Interview } from '@/types/application.types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const AVATARS: [string, string][] = [
  ['#FBEAEC', '#7C1B26'], ['#EAF1F7', '#3B7FB5'], ['#EAF5EC', '#4E9657'],
  ['#FBF3E2', '#B8860B'], ['#F1ECF7', '#6B4E9A'], ['#F7EDE8', '#C0562F'], ['#EAF1F7', '#1F4E6B'],
]
const avatar = (id: number) => AVATARS[id % AVATARS.length]

// Manila-local Y / M(0-based) / D for an ISO timestamp, so calendar buckets match
// the times shown elsewhere in the app (all rendered in Asia/Manila).
function manilaYMD(iso: string | Date): { y: number; m0: number; d: number } {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m0: m - 1, d }
}

const modeStyle = (mode: Interview['mode']) =>
  mode === 'online'
    ? { label: 'Online', color: '#6B4E9A', bg: '#F1ECF7', dot: '#6B4E9A', Icon: Video }
    : { label: 'In Person', color: '#1F5C86', bg: '#EAF1F7', dot: '#1F5C86', Icon: Users }

type IvItem = { app: Application; iv: Interview; y: number; m0: number; d: number; ts: number }

export default function AdminInterviewsPage() {
  const [view, setView] = useState<'month' | 'list'>('month')
  const today = useMemo(() => manilaYMD(new Date()), [])
  const [cursor, setCursor] = useState(() => ({ y: today.y, m: today.m0 }))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Fetch every scheduled interview (paginated 15/page server-side) so the
  // calendar can show any month without a server date filter.
  const { data, isLoading } = useQuery({
    queryKey: ['admin-interviews-all'],
    queryFn: async () => {
      const all: Application[] = []
      let page = 1
      let lastPage = 1
      do {
        const res = await applicationsApi.adminListApplications({ status: 'interview_scheduled', page: String(page) })
        all.push(...res.data)
        lastPage = res.meta?.last_page ?? 1
        page++
      } while (page <= lastPage && page <= 100)
      return all
    },
  })

  // Bucket interviews by Manila day, sorted by time within each day.
  const byKey = useMemo(() => {
    const map = new Map<string, IvItem[]>()
    for (const app of data ?? []) {
      if (!app.interview) continue
      const { y, m0, d } = manilaYMD(app.interview.scheduled_at)
      const item: IvItem = { app, iv: app.interview, y, m0, d, ts: new Date(app.interview.scheduled_at).getTime() }
      const key = `${y}-${m0}-${d}`
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.ts - b.ts)
    return map
  }, [data])

  const { y, m } = cursor
  const monthLabel = `${MONTHS[m]} ${y}`

  // calendar grid
  const weeks = useMemo(() => {
    const lead = new Date(y, m, 1).getDay()
    const dim = new Date(y, m + 1, 0).getDate()
    const total = Math.ceil((lead + dim) / 7) * 7
    const cells = Array.from({ length: total }, (_, i) => {
      const date = new Date(y, m, 1 - lead + i)
      const inMonth = date.getMonth() === m
      const num = date.getDate()
      const key = `${date.getFullYear()}-${date.getMonth()}-${num}`
      const items = inMonth ? byKey.get(key) ?? [] : []
      const isToday = inMonth && y === today.y && m === today.m0 && num === today.d
      return { key, num, inMonth, items, isToday }
    })
    return Array.from({ length: total / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  }, [y, m, byKey, today])

  const monthCount = weeks.flat().reduce((sum, c) => sum + c.items.length, 0)

  // list groups (visible month, ascending by day)
  const listGroups = useMemo(() => {
    return [...byKey.keys()]
      .filter((k) => { const [ky, km] = k.split('-').map(Number); return ky === y && km === m })
      .sort((a, b) => Number(a.split('-')[2]) - Number(b.split('-')[2]))
      .map((k) => {
        const d = Number(k.split('-')[2])
        return { key: k, label: `${WD_LONG[new Date(y, m, d).getDay()]} · ${MONTHS[m]} ${d}`, items: byKey.get(k)! }
      })
  }, [byKey, y, m])

  const prevMonth = () => setCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
  const nextMonth = () => setCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
  const goToday = () => setCursor({ y: today.y, m: today.m0 })

  const drawerItems = selectedKey ? byKey.get(selectedKey) ?? [] : []
  const drawerDate = (() => {
    if (!selectedKey) return ''
    const [ky, km, kd] = selectedKey.split('-').map(Number)
    return `${WD_SHORT[new Date(ky, km, kd).getDay()]}, ${MONTHS[km]} ${kd}`
  })()

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Scheduled Interviews</p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-[#241715]">Interviews</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-[#8A7A73]"><strong className="text-[14px] text-[#7C1B26]">{monthCount}</strong> this month</span>
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="flex h-[42px] w-[38px] items-center justify-center rounded-[10px] border border-[#EADFD4] bg-white text-[#7A6A63] hover:bg-[#FBF7F2]">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-[150px] text-center text-[15px] font-bold text-[#2B1E1B]">{monthLabel}</div>
            <button onClick={nextMonth} className="flex h-[42px] w-[38px] items-center justify-center rounded-[10px] border border-[#EADFD4] bg-white text-[#7A6A63] hover:bg-[#FBF7F2]">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button onClick={goToday} className="flex h-[42px] items-center rounded-[10px] border border-[#EADFD4] bg-white px-4 text-[13px] font-semibold text-[#2B1E1B] hover:bg-[#FBF7F2]">Today</button>
          <div className="inline-flex gap-[3px] rounded-[10px] bg-[#F1E7DC] p-1">
            {(['month', 'list'] as const).map((v) => {
              const on = view === v
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-[7px] px-4 py-2 text-[12.5px] capitalize transition-colors ${on ? 'bg-white font-semibold text-[#7C1B26] shadow-[0_1px_3px_rgba(60,30,25,.08)]' : 'font-medium text-[#8A7A73]'}`}
                >
                  {v}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[560px] animate-pulse rounded-2xl bg-[#EFE5DA]/50" />
      ) : view === 'month' ? (
        /* ── MONTH VIEW ─────────────────────────────────────────────── */
        <div className="rounded-2xl border border-[#EFE5DA] bg-white p-5 shadow-[0_2px_8px_rgba(60,30,25,.04)]">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {WD_SHORT.map((w) => (
              <div key={w} className="text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#A38A82]">{w}</div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {week.map((c) => {
                  const has = c.inMonth && c.items.length > 0
                  return (
                    <button
                      key={c.key}
                      onClick={has ? () => setSelectedKey(c.key) : undefined}
                      disabled={!has}
                      className="min-h-[108px] rounded-[11px] border p-2.5 text-left align-top"
                      style={{
                        background: !c.inMonth ? '#FAF6F0' : c.items.length ? '#FFFDFB' : '#FFFFFF',
                        borderColor: c.items.length ? '#EADBC8' : '#EFE5DA',
                        boxShadow: c.isToday ? 'inset 0 0 0 2px #7C1B26' : 'none',
                        cursor: has ? 'pointer' : 'default',
                      }}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span
                          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full text-[13px]"
                          style={{
                            fontWeight: c.items.length ? 700 : 500,
                            color: !c.inMonth ? '#C9B7AC' : c.isToday ? '#FFF8EE' : '#3F2F2A',
                            background: c.isToday ? '#7C1B26' : 'transparent',
                          }}
                        >
                          {c.num}
                        </span>
                        {has && <span className="rounded-full bg-[#7C1B26] px-1.5 py-px text-[10px] font-bold text-[#FFF1E2]">{c.items.length}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        {c.items.slice(0, 2).map((it) => (
                          <div key={it.app.id} className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[#EFE5DA] bg-[#FBF7F2] px-1.5 py-0.5 text-[10.5px] text-[#5A4A45]">
                            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: modeStyle(it.iv.mode).dot }} />
                            {(it.app.user?.name ?? '—').split(' ')[0]}
                          </div>
                        ))}
                        {c.items.length > 2 && <span className="pl-0.5 text-[10px] font-semibold text-[#7C1B26]">+{c.items.length - 2} more</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {/* legend */}
          <div className="mt-4 flex flex-wrap gap-4 border-t border-[#F4ECE1] pt-3.5">
            <span className="flex items-center gap-1.5 text-[12px] text-[#5A4A45]"><span className="h-1.5 w-1.5 rounded-full bg-[#1F5C86]" />In Person</span>
            <span className="flex items-center gap-1.5 text-[12px] text-[#5A4A45]"><span className="h-1.5 w-1.5 rounded-full bg-[#6B4E9A]" />Online</span>
            <span className="flex items-center gap-1.5 text-[12px] text-[#5A4A45]"><span className="rounded-full bg-[#7C1B26] px-1.5 py-px text-[10px] font-bold text-[#FFF1E2]">N</span>Interviews that day · click to view</span>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ──────────────────────────────────────────────── */
        listGroups.length === 0 ? (
          <EmptyState monthLabel={monthLabel} />
        ) : (
          <div className="flex flex-col gap-[18px]">
            {listGroups.map((g) => (
              <div key={g.key}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="text-[12.5px] font-bold text-[#3F2F2A]">{g.label}</span>
                  <span className="rounded-full bg-[#FBEAEC] px-2 py-px text-[11px] font-bold text-[#7C1B26]">{g.items.length}</span>
                  <span className="h-px flex-1 bg-[#ECE1D6]" />
                </div>
                <div className="overflow-hidden rounded-[13px] border border-[#EFE5DA] bg-white">
                  {g.items.map((it, i) => {
                    const ms = modeStyle(it.iv.mode)
                    const [avBg, avFg] = avatar(it.app.id)
                    return (
                      <div key={it.app.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-[18px] ${i < g.items.length - 1 ? 'border-b border-[#F4ECE1]' : ''}`}>
                        <div className="w-[66px] flex-none text-[12.5px] font-bold text-[#7C1B26]">{formatTime(it.iv.scheduled_at)}</div>
                        {it.iv.status === 'no_show' && (
                          <span className="flex-none rounded-full bg-[#FFF9EC] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309] ring-1 ring-[#F0DFAE]">No-show</span>
                        )}
                        <UserAvatar name={it.app.user?.name} avatarUrl={it.app.user?.avatar_url} className="h-9 w-9 rounded-full text-[12px] font-bold" style={{ background: avBg, color: avFg }} />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="truncate text-[13.5px] font-semibold text-[#241715]">{it.app.user?.name ?? '—'}</div>
                          <div className="truncate text-[11.5px] text-[#A38A82]">{it.app.user?.email ?? '—'}</div>
                        </div>
                        <span className="flex flex-none items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] font-semibold" style={{ color: ms.color, background: ms.bg }}>
                          <ms.Icon className="h-3.5 w-3.5" />{ms.label}
                        </span>
                        <span className="hidden flex-none text-[11.5px] text-[#5A4A45] sm:block">{it.iv.location || (it.iv.mode === 'online' ? 'Online meeting link' : 'DSA Office')}</span>
                        <Link href={`/admin/applications/${it.app.id}`} className="flex-none text-[12px] font-semibold text-[#7C1B26] hover:underline">View →</Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* empty month (calendar view) */}
      {!isLoading && view === 'month' && monthCount === 0 && (
        <EmptyState monthLabel={monthLabel} />
      )}

      {/* ── DAY DRAWER ───────────────────────────────────────────────── */}
      {selectedKey && <div onClick={() => setSelectedKey(null)} className="fixed inset-0 z-40 bg-[rgba(40,12,16,.42)]" />}
      <div
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[420px] max-w-[90vw] flex-col bg-[#FAF6F0] shadow-[-12px_0_44px_rgba(40,8,12,.28)] transition-transform duration-300"
        style={{ transform: selectedKey ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="bg-gradient-to-br from-[#7C1B26] to-[#530F17] px-6 py-5 text-[#FBEFE0]">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#F3D9A0]/80">Interview Schedule</span>
            <button onClick={() => setSelectedKey(null)} className="text-[#FBEFE0]/75 hover:text-[#FBEFE0]"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-end justify-between">
            <div className="font-serif text-2xl font-semibold text-[#FFF8EE]">{drawerDate}</div>
            <span className="rounded-full bg-[#F3D9A0]/20 px-3 py-1 text-[12px] font-bold text-[#F3D9A0]">
              {drawerItems.length} {drawerItems.length === 1 ? 'interview' : 'interviews'}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-auto px-5 py-[18px]">
          {drawerItems.map((it) => {
            const ms = modeStyle(it.iv.mode)
            const [avBg, avFg] = avatar(it.app.id)
            return (
              <div key={it.app.id} className="rounded-[13px] border border-[#EFE5DA] bg-white p-4 shadow-[0_1px_3px_rgba(60,30,25,.05)]">
                <div className="mb-3 flex items-center gap-3">
                  <UserAvatar name={it.app.user?.name} avatarUrl={it.app.user?.avatar_url} className="h-[42px] w-[42px] rounded-full text-[14px] font-bold" style={{ background: avBg, color: avFg }} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[14.5px] font-semibold text-[#241715]">{it.app.user?.name ?? '—'}</div>
                    <div className="truncate text-[12px] text-[#A38A82]">{it.app.user?.email ?? '—'}</div>
                  </div>
                  <span className="flex flex-none items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] font-semibold" style={{ color: ms.color, background: ms.bg }}>
                    <ms.Icon className="h-3.5 w-3.5" />{ms.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-[#F4ECE1] pt-3">
                  <div className="flex items-center gap-2.5 text-[12.5px] text-[#5A4A45]">
                    <Clock className="h-4 w-4 text-[#B79B7E]" />{formatTime(it.iv.scheduled_at)}
                    {it.iv.status === 'no_show' && (
                      <span className="rounded-full bg-[#FFF9EC] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309] ring-1 ring-[#F0DFAE]">No-show</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 text-[12.5px] text-[#5A4A45]">
                    {it.iv.mode === 'online' ? <Video className="h-4 w-4 text-[#B79B7E]" /> : <MapPin className="h-4 w-4 text-[#B79B7E]" />}
                    {it.iv.location || (it.iv.mode === 'online' ? 'Online meeting link' : 'DSA Office')}
                  </div>
                </div>
                <Link
                  href={`/admin/applications/${it.app.id}`}
                  className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#EADFD4] bg-[#FBF7F2] text-[12.5px] font-semibold text-[#7C1B26] hover:bg-[#F4EBE1]"
                >
                  <FileText className="h-4 w-4" /> View Application
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="rounded-[15px] border border-dashed border-[#E0D2C4] bg-white px-5 py-[60px] text-center">
      <CalendarOff className="mx-auto h-10 w-10 text-[#C9B7AC]" />
      <p className="mt-3 text-[15px] font-semibold text-[#3F2F2A]">No interviews in {monthLabel}</p>
      <p className="mt-1 text-[13px] text-[#A38A82]">
        Try another month, or schedule interviews from{' '}
        <Link href="/admin/applications" className="font-semibold text-[#7C1B26] hover:underline">Applications</Link>.
      </p>
    </div>
  )
}
