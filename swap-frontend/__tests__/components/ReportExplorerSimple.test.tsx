import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ReportResult } from '@/types/report.types'

const get = vi.fn()
vi.mock('@/lib/api/reports.api', () => ({ reportsApi: { get: (...a: unknown[]) => get(...a), export: vi.fn() } }))

import { ReportExplorer } from '@/components/reports/ReportExplorer'

const result: ReportResult = {
  title: 'My Terms', slug: 'my-terms', term: null,
  columns: [
    { key: 'term', label: 'Term', type: 'text', filterable: false, metric: false },
    { key: 'office', label: 'Office', type: 'text', filterable: true, metric: false },
    { key: 'verified_hours', label: 'Verified Hours', type: 'hours', filterable: false, metric: true },
  ],
  rows: [{ term: '1st Semester 2026-2027', office: 'CICS', verified_hours: 86.72 }],
  total_rows: 1,
  stats: [{ label: 'Terms', value: '1' }, { label: 'Verified Hours', value: '86.72' }],
  facets: { office: [{ value: 'CICS', count: 1 }] },
  group_by: 'office', metric: null,
  groups: [{ label: 'CICS', value: 1, count: 1 }],
  filters_applied: [], meta: {},
}

const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('ReportExplorer, simple view (recipient My Terms)', () => {
  beforeEach(() => { get.mockReset(); get.mockResolvedValue(result) })

  it('shows the cards, the table and the downloads, without chart, filters or search', async () => {
    wrap(<ReportExplorer role="recipient" type="terms" chart={false} filters={false} description="Every semester you’ve served."
      state={{ filters: { office: ['Elsewhere'] }, search: 'old' }} onChange={() => {}} />)

    expect(await screen.findByText('My Terms')).toBeTruthy()
    expect(screen.getByText('Every semester you’ve served.')).toBeTruthy()
    expect(screen.getByText('86.72', { selector: 'div' })).toBeTruthy()
    expect(screen.getAllByText('1st Semester 2026-2027').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /PDF/i })).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Search/i)).toBeNull()
    expect(screen.queryByText(/Records by/i)).toBeNull()
    expect(screen.queryByText(/Include graph/i)).toBeNull()

    // A filter or search left in the URL isn't sent, so it can't hide rows.
    expect(get.mock.calls[0][2]).toMatchObject({ filters: {}, search: undefined })
  })

  it('keeps the filters and search by default (admin, supervisor, My Time Logs)', async () => {
    // (chart off here only because the test browser has no ResizeObserver for the chart library)
    wrap(<ReportExplorer role="admin" type="terms" chart={false} state={{ filters: {} }} onChange={() => {}} />)
    expect(await screen.findByPlaceholderText(/Search/i)).toBeTruthy()
  })
})
