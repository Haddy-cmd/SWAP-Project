'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReportCell, ReportColumn } from '@/types/report.types'
import { formatCell, NUMERIC_TYPES, statusTone } from './format'

const PAGE_SIZE = 25

interface Props {
  columns: ReportColumn[]
  rows: Record<string, ReportCell>[]
  sort?: string
  dir?: 'asc' | 'desc'
  /** Header click; the backend sorts, so downloads keep the same order. */
  onSort: (key: string) => void
}

export function ReportTable({ columns, rows, sort, dir, onSort }: Props) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // A new filter or sort starts back at page 1.
  useEffect(() => setPage(0), [rows])
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (rows.length === 0) {
    return (
      <div className="rounded-[15px] border border-dashed border-ink-300 bg-ink-50 py-14 text-center text-[13px] text-ink-500">
        No records match these filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[15px] border border-ink-200 bg-white shadow-[0_2px_8px_rgba(19,36,26,0.04)]">
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-ink-50">
            <tr>
              {columns.map((c) => {
                const numeric = NUMERIC_TYPES.includes(c.type)
                const active = sort === c.key
                const Icon = active ? (dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                    className={`whitespace-nowrap border-b-2 border-ink-200 px-3 py-0 ${numeric ? 'text-right' : 'text-left'}`}>
                    <button onClick={() => onSort(c.key)} title={`Sort by ${c.label}`}
                      className={`inline-flex items-center gap-1 py-2.5 text-[10.5px] font-bold uppercase tracking-wide ${active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'} ${numeric ? 'flex-row-reverse' : ''}`}>
                      {c.label} <Icon className={`h-3 w-3 ${active ? '' : 'opacity-40'}`} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, ri) => (
              <tr key={page * PAGE_SIZE + ri} className="hover:bg-ink-50/70">
                {columns.map((c, ci) => {
                  const text = formatCell(r[c.key] ?? null, c.type)
                  const numeric = NUMERIC_TYPES.includes(c.type)
                  return (
                    <td key={c.key} className={`whitespace-nowrap border-b border-ink-100 px-3 py-2 ${numeric ? 'text-right tabular-nums text-ink-800' : 'text-ink-700'} ${ci === 0 ? 'font-semibold text-ink-900' : ''} ${c.key === 'task' ? 'max-w-[320px] truncate' : ''}`}
                      title={c.key === 'task' && text !== '—' ? text : undefined}>
                      {c.type === 'status' && text !== '—'
                        ? <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(text)}`}>{text}</span>
                        : text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-ink-200 bg-ink-50 px-4 py-2.5 text-[12px] text-ink-500">
        <span>Showing {page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length}</span>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page"
              className="rounded-lg p-1.5 hover:bg-ink-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 tabular-nums">Page {page + 1} of {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page"
              className="rounded-lg p-1.5 hover:bg-ink-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
