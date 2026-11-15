'use client'

import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ArrowRight, Filter, X } from 'lucide-react'
import { reportsApi } from '@/lib/api/reports.api'
import { termParams } from '@/lib/utils/term'
import { CountUp } from '@/components/ui/CountUp'
import { REPORT_BLANK } from '@/types/report.types'
import { BLUE, CARD, GOLD, GREEN, RED, Card, Labeled, SELECT, Seg, Skeleton, pct, type TabProps } from './shared'

type Group = 'college' | 'program' | 'year_level'
type Status = 'all' | 'approved' | 'rejected' | 'waiting'
type Sort = 'n' | 'a' | 'r' | 'rr' | 'w' | 'az'

const SORTS: Record<Sort, string> = {
  n: 'Most applicants', a: 'Most approved', r: 'Most rejected', rr: 'Highest rejection rate', w: 'Most still waiting', az: 'A–Z',
}
const GROUP_LABEL: Record<Group, string> = { college: 'College', program: 'Program', year_level: 'Year level' }

interface Row { name: string; n: number; a: number; r: number; w: number; rr: number }

/**
 * Applications: every application of the term (new and renewals) broken down by college,
 * program or year level — approved / rejected / still waiting and the rejection rate.
 * Pick a college (or click its row) to see its programs; "See every application" opens the
 * full list in All reports with the same college.
 */
export function ApplicationsTab({ academicYear, semester, onDrill }: TabProps) {
  const [college, setCollege] = useState<string>('all')
  const [status, setStatus] = useState<Status>('all')
  const [group, setGroup] = useState<Group>('college')
  const [sort, setSort] = useState<Sort>('n')
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['report', 'admin', 'applications', { ...termParams(academicYear, semester), filters: {} }],
    queryFn: () => reportsApi.get('admin', 'applications', { ...termParams(academicYear, semester), filters: {} }),
    placeholderData: keepPreviousData,
  })

  const atoms = useMemo(() => (data?.rows ?? []).map((row) => {
    const s = String(row.status ?? '')
    const text = (v: unknown) => (v == null || v === '' ? REPORT_BLANK : String(v))
    return {
      college: text(row.college), program: text(row.program), year_level: text(row.year_level),
      a: s === 'Approved' ? 1 : 0, r: s === 'Rejected' ? 1 : 0,
    }
  }), [data])

  const colleges = useMemo(() => Array.from(new Set(atoms.map((x) => x.college))).sort((x, y) => x.localeCompare(y)), [atoms])
  const scoped = atoms.filter((x) => college === 'all' || x.college === college)

  const rows = useMemo(() => {
    const agg = new Map<string, Row>()
    for (const x of scoped) {
      const key = x[group]
      const g = agg.get(key) ?? { name: key, n: 0, a: 0, r: 0, w: 0, rr: 0 }
      g.n++; g.a += x.a; g.r += x.r
      agg.set(key, g)
    }
    let out = Array.from(agg.values()).map((g) => ({ ...g, w: g.n - g.a - g.r, rr: g.n ? g.r / g.n : 0 }))
    if (status !== 'all') out = out.filter((g) => (status === 'approved' ? g.a : status === 'rejected' ? g.r : g.w) > 0)
    out.sort(sort === 'az' ? (x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }) : (x, y) => y[sort] - x[sort] || x.name.localeCompare(y.name))
    return out
  }, [scoped, group, status, sort])

  const tot = scoped.reduce((o, x) => ({ n: o.n + 1, a: o.a + x.a, r: o.r + x.r }), { n: 0, a: 0, r: 0 })
  const maxN = Math.max(1, ...rows.map((g) => g.n))
  const shown = showAll ? rows : rows.slice(0, 8)
  const gName = GROUP_LABEL[group].toLowerCase()

  const focus = (c: string) => {
    setCollege(c)
    setGroup(c === 'all' ? 'college' : group === 'college' ? 'program' : group)
    setShowAll(false)
  }

  if (isLoading && !data) return <div className="space-y-4"><Skeleton h="h-16" /><Skeleton h="h-24" /><Skeleton h="h-96" /></div>

  const hi = (on: boolean, color: string) => (on ? { color, fontWeight: 800 } : { color: 'var(--text-ink-600)' })
  const collegeName = college === REPORT_BLANK ? 'No college set' : college

  return (
    <div className="space-y-[18px]">
      {/* Filters */}
      <div className={`${CARD} flex flex-wrap items-center gap-x-5 gap-y-3 px-[18px] py-3.5`}>
        <Labeled label="College">
          <select value={college} onChange={(e) => focus(e.target.value)} className={SELECT} aria-label="College">
            <option value="all">All colleges</option>
            {colleges.map((c) => <option key={c} value={c}>{c === REPORT_BLANK ? 'No college set' : c}</option>)}
          </select>
        </Labeled>
        <Labeled label="Status">
          <Seg label="Status" value={status} onChange={setStatus}
            options={[['all', 'All'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['waiting', 'Waiting']] as const} />
        </Labeled>
        {college !== 'all' && (
          <button onClick={() => focus('all')} className="ml-auto flex h-[34px] items-center gap-1.5 rounded-full bg-accent-deep pl-3 pr-2 text-[12.5px] font-semibold text-white">
            Showing {collegeName} only <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          { label: 'Applicants', value: tot.n, hint: college === 'all' ? 'all colleges, new and renewals' : `${collegeName} only`, color: BLUE },
          { label: 'Approved', value: tot.a, hint: `${pct(tot.a, tot.n)}% of applicants`, color: GREEN },
          { label: 'Rejected', value: tot.r, hint: `${pct(tot.r, tot.n)}% of applicants`, color: RED },
          { label: 'Still waiting', value: tot.n - tot.a - tot.r, hint: 'no decision yet', color: GOLD },
        ].map((k) => (
          <div key={k.label} className={`${CARD} px-[18px] py-4`}>
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-600"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: k.color }} />{k.label}</p>
            <CountUp value={k.value} className="mt-2 block text-[28px] font-extrabold leading-none" />
            <p className="mt-1.5 text-xs text-ink-500">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <Card
        title={`Applicants by ${gName}${college !== 'all' ? ` · ${collegeName}` : ''}`}
        hint={rows[0]
          ? `Sorted by ${SORTS[sort].toLowerCase()}${sort === 'az' ? '' : ` · ${rows[0].name === REPORT_BLANK ? 'not set' : rows[0].name} is first`}${group === 'college' ? ' · click a college to focus on it' : ''}`
          : 'Nothing matches these filters.'}
        right={
          <div className="flex flex-wrap items-center gap-3.5">
            <Labeled label="Group by">
              <Seg label="Group by" value={group} onChange={(g) => { setGroup(g); setShowAll(false) }}
                options={([['college', 'College'], ['program', 'Program'], ['year_level', 'Year level']] as const).filter(([g]) => !(college !== 'all' && g === 'college'))} />
            </Labeled>
            <Labeled label="Sort">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={SELECT} aria-label="Sort">
                {(Object.keys(SORTS) as Sort[]).map((s) => <option key={s} value={s}>{SORTS[s]}</option>)}
              </select>
            </Labeled>
          </div>
        }>
        <div className="mt-3.5 flex flex-wrap gap-4 text-xs text-ink-600">
          {([['Approved', GREEN], ['Rejected', RED], ['Still waiting', GOLD]] as const).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: c }} />{l}</span>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="sm:min-w-[720px]">
            <div className="hidden grid-cols-[minmax(170px,1.3fr)_minmax(160px,1.6fr)_74px_74px_74px_74px_92px] gap-3 sm:grid rounded-[10px] bg-surface-2 px-3 py-2.5 text-[11.5px] font-bold text-ink-500">
              <span>{GROUP_LABEL[group]}</span><span>Breakdown</span>
              <span className="text-right">Applicants</span><span className="text-right">Approved</span><span className="text-right">Rejected</span>
              <span className="text-right">Waiting</span><span className="text-right">Rejection rate</span>
            </div>
            {shown.map((g) => {
              const rate = Math.round(g.rr * 100)
              const tone = rate >= 15 ? ['var(--color-red-strong)', 'var(--color-danger-100)'] : rate >= 8 ? ['var(--color-gold-700)', 'var(--color-gold-100)'] : ['var(--color-accent-strong)', 'var(--color-accent-soft)']
              const clickable = group === 'college'
              const w = (v: number, on: boolean) => `${on ? (v / maxN) * 100 : 0}%`
              return (
                <div key={g.name} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => focus(g.name) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter') focus(g.name) } : undefined}
                  title={clickable ? `Focus on ${g.name}` : undefined}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 sm:grid sm:grid-cols-[minmax(170px,1.3fr)_minmax(160px,1.6fr)_74px_74px_74px_74px_92px] border-b border-ink-900/[.04] px-3 py-[11px] text-[13px] ${clickable ? 'cursor-pointer hover:bg-surface-2' : ''}`}>
                  <span className="order-1 flex w-[calc(100%-4.5rem)] min-w-0 items-center gap-1.5 sm:order-none sm:w-auto">
                    <span className="truncate font-semibold">{g.name === REPORT_BLANK ? 'Not set' : g.name}</span>
                    {clickable && <Filter className="h-3.5 w-3.5 flex-none text-ink-400" />}
                  </span>
                  <div className="order-3 flex h-3 w-full overflow-hidden rounded-md bg-surface-3 sm:order-none sm:w-auto">
                    <div className="bar-grow-x" style={{ width: w(g.a, status === 'all' || status === 'approved'), background: GREEN }} />
                    <div className="bar-grow-x" style={{ width: w(g.r, status === 'all' || status === 'rejected'), background: RED }} />
                    <div className="bar-grow-x" style={{ width: w(g.w, status === 'all' || status === 'waiting'), background: GOLD }} />
                  </div>
                  <span className="order-4 w-full text-[12px] text-ink-500 sm:hidden">{g.n} applicants · {g.a} approved · {g.r} rejected · {g.w} waiting</span>
                  <strong className="hidden text-right sm:block">{g.n}</strong>
                  <span className="hidden text-right sm:block" style={hi(status === 'approved' || sort === 'a', 'var(--color-accent-strong)')}>{g.a}</span>
                  <span className="hidden text-right sm:block" style={hi(status === 'rejected' || sort === 'r' || sort === 'rr', 'var(--color-red-strong)')}>{g.r}</span>
                  <span className="hidden text-right sm:block" style={hi(status === 'waiting' || sort === 'w', 'var(--color-gold-700)')}>{g.w}</span>
                  <span className="order-2 ml-auto text-right sm:order-none sm:ml-0"><span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: tone[0], background: tone[1] }}>{rate}%</span></span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {rows.length > 8 ? (
            <button onClick={() => setShowAll((v) => !v)} className="h-[34px] rounded-[9px] border border-ink-200 bg-surface px-3.5 text-[12.5px] font-semibold text-accent-strong">
              {showAll ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          ) : <span />}
          <button onClick={() => onDrill({ tab: 'applications', filters: college === 'all' ? {} : { college: [college] } })}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:text-accent-hover">
            See every application <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  )
}
