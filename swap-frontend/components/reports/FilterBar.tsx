'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import type { ReportColumn, ReportFacetValue } from '@/types/report.types'
import { toggleFilter } from '@/lib/utils/reportQuery'

interface Props {
  columns: ReportColumn[]
  facets: Record<string, ReportFacetValue[]>
  filters: Record<string, string[]>
  search?: string
  onFilters: (filters: Record<string, string[]>) => void
  onSearch: (search: string | undefined) => void
}

/**
 * One dropdown per filterable column (with how many rows carry each value), the
 * active filters as removable chips, and a text search. Values within a column are
 * OR'd, columns AND'd — the backend applies the same rule (ReportQuery).
 */
export function FilterBar({ columns, facets, filters, search, onFilters, onSearch }: Props) {
  const filterable = columns.filter((c) => c.filterable && (facets[c.key]?.length ?? 0) > 0)
  const active = Object.entries(filters).flatMap(([col, values]) => values.map((v) => ({ col, v })))
  const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key

  // Search is typed freely and sent once the viewer pauses.
  const [text, setText] = useState(search ?? '')
  useEffect(() => setText(search ?? ''), [search])
  useEffect(() => {
    const next = text.trim() || undefined
    if (next === (search || undefined)) return
    const t = setTimeout(() => onSearch(next), 350)
    return () => clearTimeout(t)
  }, [text, search, onSearch])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pr-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
        </span>
        {filterable.map((c) => (
          <FacetDropdown key={c.key} column={c} values={facets[c.key] ?? []} selected={filters[c.key] ?? []}
            onToggle={(v) => onFilters(toggleFilter(filters, c.key, v))}
            onClear={() => { const next = { ...filters }; delete next[c.key]; onFilters(next) }} />
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search names, IDs, offices…" aria-label="Search the report"
            className="h-9 w-full rounded-[10px] border border-ink-200 bg-white pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
        </div>
      </div>

      {(active.length > 0 || search) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map(({ col, v }) => (
            <button key={col + v} onClick={() => onFilters(toggleFilter(filters, col, v))}
              className="flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-2 text-[12px] font-semibold text-brand-800 hover:bg-brand-100"
              aria-label={`Remove filter ${label(col)} ${v}`}>
              <span className="font-normal text-brand-700">{label(col)}:</span> {v} <X className="h-3.5 w-3.5" />
            </button>
          ))}
          {search && (
            <button onClick={() => onSearch(undefined)}
              className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 py-1 pl-3 pr-2 text-[12px] font-semibold text-ink-700 hover:bg-ink-100">
              <span className="font-normal">Search:</span> “{search}” <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => { onFilters({}); onSearch(undefined) }} className="px-2 text-[12px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FacetDropdown({ column, values, selected, onToggle, onClear }: {
  column: ReportColumn
  values: ReportFacetValue[]
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const shown = values.filter((v) => v.value.toLowerCase().includes(q.toLowerCase()))
  const on = selected.length > 0

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-semibold transition-colors ${on ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'}`}>
        {column.label}
        {on && <span className="rounded-full bg-brand-700 px-1.5 text-[10.5px] leading-[18px] text-white">{selected.length}</span>}
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[42px] z-30 w-64 rounded-xl border border-ink-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(19,36,26,.18)]">
            {values.length > 8 && (
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${column.label.toLowerCase()}…`}
                className="mb-1 h-8 w-full rounded-lg border border-ink-200 px-2.5 text-[12.5px] focus:border-brand-700 focus:outline-none" />
            )}
            <div className="max-h-64 overflow-y-auto">
              {shown.map((v) => {
                const checked = selected.includes(v.value)
                return (
                  <button key={v.value} onClick={() => onToggle(v.value)} role="menuitemcheckbox" aria-checked={checked}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-ink-800 hover:bg-ink-50">
                    <span className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${checked ? 'border-brand-700 bg-brand-700' : 'border-ink-300'}`}>
                      {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{v.value}</span>
                    <span className="text-[11px] tabular-nums text-ink-400">{v.count}</span>
                  </button>
                )
              })}
              {shown.length === 0 && <p className="px-2.5 py-2 text-[12px] text-ink-400">No match.</p>}
            </div>
            {on && (
              <button onClick={() => { onClear(); setOpen(false) }} className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-ink-500 hover:bg-ink-50">
                Clear {column.label}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
