import { describe, it, expect } from 'vitest'
import { buildReportUrl, drillTo, nextSort, parseReportUrl, toggleFilter, type ReportUrlState } from '@/lib/utils/reportQuery'

const base: ReportUrlState = { tab: 'term-results', ay: '2025-2026', sem: '1st Semester', filters: {} }

describe('report URL state', () => {
  it('round-trips filters, sort, grouping and the term', () => {
    const state: ReportUrlState = {
      ...base,
      filters: { college: ['CICS', 'College of Arts, Social Sciences'], verdict: ['Deficient'] },
      search: 'ana', sort: 'deficient_hours', dir: 'desc', group_by: 'college', metric: 'deficient_hours',
    }
    const parsed = parseReportUrl(new URLSearchParams(buildReportUrl(state)))
    expect(parsed).toEqual(state)
  })

  it('writes one f_<column> param per value, so values may contain commas', () => {
    const qs = buildReportUrl({ ...base, filters: { college: ['A, B', 'C'] } })
    expect(new URLSearchParams(qs).getAll('f_college')).toEqual(['A, B', 'C'])
  })

  it('omits dir when nothing is sorted and ignores empty filter values', () => {
    expect(buildReportUrl({ ...base, dir: 'desc' })).not.toContain('dir=')
    expect(parseReportUrl(new URLSearchParams('f_college=&tab=x')).filters).toEqual({})
  })
})

describe('toggleFilter', () => {
  it('adds a value, then removes it and drops the empty column', () => {
    const once = toggleFilter({}, 'college', 'CICS')
    expect(once).toEqual({ college: ['CICS'] })
    expect(toggleFilter(once, 'college', 'CNSM')).toEqual({ college: ['CICS', 'CNSM'] })
    expect(toggleFilter(once, 'college', 'CICS')).toEqual({})
  })
})

describe('nextSort', () => {
  it('cycles ascending → descending → off, and restarts on a new column', () => {
    expect(nextSort({}, 'hours')).toEqual({ sort: 'hours', dir: 'asc' })
    expect(nextSort({ sort: 'hours', dir: 'asc' }, 'hours')).toEqual({ sort: 'hours', dir: 'desc' })
    expect(nextSort({ sort: 'hours', dir: 'desc' }, 'hours')).toEqual({ sort: undefined, dir: undefined })
    expect(nextSort({ sort: 'hours', dir: 'desc' }, 'college')).toEqual({ sort: 'college', dir: 'asc' })
  })
})

describe('drillTo', () => {
  it('opens the tab with only the drill filters, keeping the term', () => {
    const from: ReportUrlState = { ...base, tab: 'overview', filters: { office: ['Library'] }, search: 'x', group_by: 'office' }
    expect(drillTo(from, { tab: 'term-results', filters: { verdict: ['Deficient'] }, sort: 'deficient_hours', dir: 'desc' })).toEqual({
      tab: 'term-results', ay: '2025-2026', sem: '1st Semester',
      filters: { verdict: ['Deficient'] }, sort: 'deficient_hours', dir: 'desc',
    })
  })
})
