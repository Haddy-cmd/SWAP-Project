'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ClipboardList, Search, SlidersHorizontal, X } from 'lucide-react'
import { auditApi } from '@/lib/api/analytics.api'
import { AuditEntryRow } from '@/components/admin/AuditEntryRow'
import type { AuditFilters, AuditOptions } from '@/types/audit.types'

const KEYS: (keyof AuditFilters)[] = ['area', 'actor_id', 'subject', 'subject_user_id', 'record', 'from', 'to', 'sensitive', 'include_testing', 'page']
const SELECT = 'h-9 w-full cursor-pointer appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-[13px] text-ink-800 focus:border-brand-700 focus:outline-none'
const INPUT = 'h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-[13px] text-ink-800 focus:border-brand-700 focus:outline-none'

// ── Dates: quick choices map to from/to (Manila days, like the API) ──
type Preset = 'any' | 'today' | '7' | '30' | 'custom'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'any', label: 'Any time' }, { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' }, { key: 'custom', label: 'Custom' },
]
/** YYYY-MM-DD in Manila, `back` days ago. */
const manilaDay = (back = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() - back * 86_400_000))
const presetRange = (p: Preset): { from?: string; to?: string } =>
  p === 'today' ? { from: manilaDay(), to: undefined }
    : p === '7' ? { from: manilaDay(6), to: undefined }
    : p === '30' ? { from: manilaDay(29), to: undefined }
    : { from: undefined, to: undefined }
const presetOf = (f: AuditFilters): Preset => {
  if (!f.from && !f.to) return 'any'
  if (!f.to && f.from === manilaDay()) return 'today'
  if (!f.to && f.from === manilaDay(6)) return '7'
  if (!f.to && f.from === manilaDay(29)) return '30'
  return 'custom'
}
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

/**
 * Admin → Audit Logs: every recorded change as a readable sentence. One search box (the
 * student) and one Filters panel (area, who, date, sensitive only, System Testing); active
 * filters show as removable chips. Filters live in the URL, so a view can be shared or reopened
 * (the History panels link here).
 */
function AuditLogsView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? undefined]).filter(([, v]) => v)) as AuditFilters
  const [subject, setSubject] = useState(filters.subject ?? '')
  const [panelOpen, setPanelOpen] = useState(false)

  const set = (next: Partial<AuditFilters>) => {
    const merged: AuditFilters = { ...filters, ...next }
    if (!('page' in next)) delete merged.page
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Typing in the search box filters after a short pause.
  useEffect(() => {
    if ((filters.subject ?? '') === subject.trim()) return
    const t = setTimeout(() => set({ subject: subject.trim() || undefined }), 350)
    return () => clearTimeout(t)
  }, [subject]) // eslint-disable-line

  const { data: options } = useQuery({ queryKey: ['audit-options'], queryFn: auditApi.options, staleTime: 5 * 60_000 })
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditApi.list(filters),
    placeholderData: (prev) => prev,
  })
  const entries = data?.data ?? []
  const meta = data?.meta
  const page = Number(filters.page ?? 1)

  const chips = activeChips(filters, options)
  const panelCount = chips.filter((c) => c.inPanel).length
  const clearAll = () => { setSubject(''); router.replace(pathname, { scroll: false }) }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-ink-500">Who changed what, and when. Click an entry to see exactly what changed.</p>
      </div>

      {/* Search + Filters */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Search a student by name, email or ID"
            aria-label="Search a student" className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-9 text-sm shadow-sm focus:border-brand-700 focus:outline-none" />
          {subject && (
            <button onClick={() => setSubject('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-haspopup="dialog"
          className={`flex h-11 flex-shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition-colors ${
            panelCount ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'}`}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {panelCount > 0 && <span className="rounded-full bg-brand-700 px-1.5 text-[11px] text-white">{panelCount}</span>}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>
        {panelOpen && <FiltersPanel filters={filters} options={options} set={set} onClose={() => setPanelOpen(false)} />}
      </div>

      {/* What's applied, each removable */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white py-1 pl-3 pr-1.5 text-[12.5px] text-ink-700 shadow-sm">
              {c.label}
              <button onClick={() => { if (c.key === 'subject') setSubject(''); else set(c.clear) }} aria-label={`Remove ${c.label}`}
                className="rounded-full p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          {chips.length > 1 && <button onClick={clearAll} className="text-[12.5px] font-semibold text-brand-700 hover:underline">Clear all</button>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-100" />)}</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-ink-300" />
            <p className="text-sm text-ink-500">{chips.length ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'}</p>
            {chips.length > 0 && <button onClick={clearAll} className="text-sm font-semibold text-brand-700 hover:underline">Clear filters</button>}
          </div>
        ) : (
          <ul className={isFetching ? 'opacity-60 transition-opacity' : ''}>
            {entries.map((e) => <AuditEntryRow key={e.id} entry={e} />)}
          </ul>
        )}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
            <p className="text-xs text-ink-500">Page {meta.current_page} of {meta.last_page} · {meta.total} entries</p>
            <div className="flex gap-2">
              <button onClick={() => set({ page: String(page - 1) })} disabled={page <= 1}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-40">Previous</button>
              <button onClick={() => set({ page: String(page + 1) })} disabled={page >= meta.last_page}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The panel under the Filters button: changes apply right away; Done / Escape / a click outside close it. */
function FiltersPanel({ filters, options, set, onClose }: {
  filters: AuditFilters
  options?: AuditOptions
  set: (next: Partial<AuditFilters>) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [preset, setPreset] = useState<Preset>(presetOf(filters))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown', onKey)
    // Next tick, so the click that opened the panel doesn't close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); clearTimeout(t) }
  }, [onClose])

  const choose = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') set(presetRange(p))
  }

  return (
    <div ref={ref} role="dialog" aria-label="Filters"
      className="absolute right-0 top-[calc(100%+6px)] z-30 w-full space-y-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-xl sm:w-[380px]">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[12px] font-semibold text-ink-600">
          Area
          <div className="relative mt-1">
            <select value={filters.area ?? ''} onChange={(e) => set({ area: e.target.value || undefined })} className={SELECT}>
              <option value="">All areas</option>
              {options?.areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          </div>
        </label>
        <label className="text-[12px] font-semibold text-ink-600">
          Who did it
          <div className="relative mt-1">
            <select value={filters.actor_id ?? ''} onChange={(e) => set({ actor_id: e.target.value || undefined })} className={SELECT}>
              <option value="">Anyone</option>
              {options?.actors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          </div>
        </label>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-ink-600">Date</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => choose(p.key)} aria-pressed={preset === p.key}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${preset === p.key ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-500">
            <input type="date" aria-label="From" value={filters.from ?? ''} max={filters.to} onChange={(e) => set({ from: e.target.value || undefined })} className={`${INPUT} flex-1`} />
            to
            <input type="date" aria-label="To" value={filters.to ?? ''} min={filters.from} onChange={(e) => set({ to: e.target.value || undefined })} className={`${INPUT} flex-1`} />
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={!!filters.sensitive} onChange={(e) => set({ sensitive: e.target.checked ? '1' : undefined })} className="mt-0.5 h-4 w-4 accent-brand-700" />
          <span className="text-[13px] text-ink-800">Sensitive only<span className="block text-[11.5px] text-ink-500">Voids, role changes, deletions, exports, password and semester changes</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={!!filters.include_testing} onChange={(e) => set({ include_testing: e.target.checked ? '1' : undefined })} className="mt-0.5 h-4 w-4 accent-brand-700" />
          <span className="text-[13px] text-ink-800">Include System Testing<span className="block text-[11.5px] text-ink-500">Hidden by default so test runs don&apos;t bury real activity</span></span>
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 pt-3">
        <button type="button" onClick={() => { setPreset('any'); set({ area: undefined, actor_id: undefined, from: undefined, to: undefined, sensitive: undefined, include_testing: undefined }) }}
          className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-800">Reset</button>
        <button type="button" onClick={onClose} className="rounded-lg bg-brand-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-600">Done</button>
      </div>
    </div>
  )
}

/** The applied filters as chips; `inPanel` ones count on the Filters button. */
function activeChips(f: AuditFilters, options?: AuditOptions) {
  const chips: { key: string; label: string; clear: Partial<AuditFilters>; inPanel: boolean }[] = []
  if (f.subject) chips.push({ key: 'subject', label: `Student: ${f.subject}`, clear: { subject: undefined }, inPanel: false })
  if (f.area) chips.push({ key: 'area', label: `Area: ${options?.areas.find((a) => a.key === f.area)?.label ?? f.area}`, clear: { area: undefined }, inPanel: true })
  if (f.actor_id) chips.push({ key: 'actor', label: `Who: ${options?.actors.find((a) => String(a.id) === f.actor_id)?.name ?? `#${f.actor_id}`}`, clear: { actor_id: undefined }, inPanel: true })
  if (f.from || f.to) {
    const p = presetOf(f)
    const label = p === 'today' ? 'Today' : p === '7' ? 'Last 7 days' : p === '30' ? 'Last 30 days'
      : f.from && f.to ? `${shortDate(f.from)} – ${shortDate(f.to)}` : f.from ? `From ${shortDate(f.from)}` : `Until ${shortDate(f.to!)}`
    chips.push({ key: 'date', label, clear: { from: undefined, to: undefined }, inPanel: true })
  }
  if (f.sensitive) chips.push({ key: 'sensitive', label: 'Sensitive only', clear: { sensitive: undefined }, inPanel: true })
  if (f.include_testing) chips.push({ key: 'testing', label: 'Incl. System Testing', clear: { include_testing: undefined }, inPanel: true })
  if (f.record) chips.push({ key: 'record', label: `One record: ${f.record.replace(':', ' #').replace('_', ' ')}`, clear: { record: undefined }, inPanel: false })
  if (f.subject_user_id) chips.push({ key: 'account', label: 'One account', clear: { subject_user_id: undefined }, inPanel: false })
  return chips
}

export default function AuditLogsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-ink-100" />}>
      <AuditLogsView />
    </Suspense>
  )
}
