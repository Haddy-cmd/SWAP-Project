'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { LoadingSpinner } from './LoadingSpinner'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: keyof T | string
  header: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: keyof T
  isLoading?: boolean
  meta?: PaginationMeta
  onPageChange?: (page: number) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id' as keyof T,
  isLoading,
  meta,
  onPageChange,
  emptyTitle = 'No records found',
  emptyDescription,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E2E8F0]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]',
                    col.sortable && 'cursor-pointer select-none hover:text-[#1E293B]'
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === String(col.key) ? (
                        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-4">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={String(row[keyField] ?? i)} className="hover:bg-[#F8FAFC] transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="whitespace-nowrap px-4 py-3 text-sm text-[#1E293B]">
                      {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3">
          <p className="text-sm text-[#64748B]">
            Showing page {meta.current_page} of {meta.last_page} ({meta.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(meta.current_page - 1)}
              disabled={meta.current_page === 1}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#1E293B] disabled:opacity-40 hover:bg-[#F8FAFC]"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange?.(meta.current_page + 1)}
              disabled={meta.current_page === meta.last_page}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#1E293B] disabled:opacity-40 hover:bg-[#F8FAFC]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
