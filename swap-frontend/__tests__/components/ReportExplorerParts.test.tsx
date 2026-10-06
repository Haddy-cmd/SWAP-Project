import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ReportTable } from '@/components/reports/ReportTable'
import { FilterBar } from '@/components/reports/FilterBar'
import { formatCell } from '@/components/reports/format'
import type { ReportColumn } from '@/types/report.types'

const columns: ReportColumn[] = [
  { key: 'recipient', label: 'Recipient', type: 'text', filterable: false, metric: false },
  { key: 'college', label: 'College', type: 'text', filterable: true, metric: false },
  { key: 'verdict', label: 'Verdict', type: 'status', filterable: true, metric: false },
  { key: 'deficient_hours', label: 'Deficient Hours', type: 'hours', filterable: false, metric: true },
]

const rows = [
  { recipient: 'Ana', college: 'CICS', verdict: 'Deficient', deficient_hours: 8 },
  { recipient: 'Dan', college: 'CNSM', verdict: 'Qualified', deficient_hours: null },
]

describe('ReportTable', () => {
  it('formats cells, badges statuses and asks the parent to sort on a header click', () => {
    const onSort = vi.fn()
    render(<ReportTable columns={columns} rows={rows} sort="deficient_hours" dir="desc" onSort={onSort} />)

    expect(screen.getByText('Deficient')).toHaveClass('rounded-full')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByRole('columnheader', { name: /Deficient Hours/ })).toHaveAttribute('aria-sort', 'descending')

    fireEvent.click(screen.getByRole('button', { name: /College/ }))
    expect(onSort).toHaveBeenCalledWith('college')
  })

  it('says so when no row matches', () => {
    render(<ReportTable columns={columns} rows={[]} onSort={() => {}} />)
    expect(screen.getByText('No records match these filters.')).toBeInTheDocument()
  })
})

describe('FilterBar', () => {
  const facets = {
    college: [{ value: 'CICS', count: 2 }, { value: 'CNSM', count: 1 }],
    verdict: [{ value: 'Deficient', count: 3 }],
  }

  it('toggles a facet value from its dropdown', () => {
    const onFilters = vi.fn()
    render(<FilterBar columns={columns} facets={facets} filters={{}} onFilters={onFilters} onSearch={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /^College/ }))
    const option = screen.getByRole('menuitemcheckbox', { name: /CNSM/ })
    expect(within(option).getByText('1')).toBeInTheDocument()
    fireEvent.click(option)
    expect(onFilters).toHaveBeenCalledWith({ college: ['CNSM'] })
  })

  it('shows active filters as chips that remove themselves, and clears all', () => {
    const onFilters = vi.fn()
    const onSearch = vi.fn()
    render(<FilterBar columns={columns} facets={facets} filters={{ college: ['CICS'], verdict: ['Deficient'] }} search="ana"
      onFilters={onFilters} onSearch={onSearch} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter College CICS' }))
    expect(onFilters).toHaveBeenLastCalledWith({ verdict: ['Deficient'] })

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onFilters).toHaveBeenLastCalledWith({})
    expect(onSearch).toHaveBeenLastCalledWith(undefined)
  })
})

describe('formatCell', () => {
  it('prints money, hours and percents like the PDF does', () => {
    expect(formatCell(5000, 'money')).toBe('₱5,000.00')
    expect(formatCell(7.5, 'hours')).toBe('7.5')
    expect(formatCell(12.25, 'percent')).toBe('12.3%')
    expect(formatCell(null, 'text')).toBe('—')
  })
})
