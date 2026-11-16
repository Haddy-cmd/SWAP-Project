'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, BadgeCheck, ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, TrendingDown, TrendingUp, Users, X,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { reportsApi } from '@/lib/api/reports.api'
import { supervisorApi } from '@/lib/api/supervisor.api'
import { useReportUrlState } from '@/lib/hooks/useReportUrlState'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { ReportExplorer } from '@/components/reports/ReportExplorer'
import { TermSelect, resolveTerm } from '@/components/reports/TermSelect'
import { RequiredHoursModal } from '@/components/attendance/HoursModals'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { TermBadge } from '@/components/shared/TermBadge'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { TermReportReviewModal } from '@/components/supervisor/TermReportReview'
import { StudentDocumentsModal } from '@/components/supervisor/students/StudentDocumentsModal'
import { EmptyPanel, StudentPanel } from '@/components/supervisor/students/StudentPanel'
import { FiltersPopover } from '@/components/supervisor/students/FiltersPopover'
import {
  FILTERS, GROUPS, SORTS, barColor, behind, hrs, matchesSearch, pctOf, qualified, toRow,
  type FilterKey, type GroupKey, type Row, type SortKey,
} from '@/components/supervisor/students/rows'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const PER_PAGE = 12

const GROUP_LOOK: Record<GroupKey, { Icon: typeof Users; on: string; icon: string; sub: string }> = {
  action: { Icon: AlertCircle, on: 'border-warning-600 bg-gold-50', icon: 'bg-gold-50 text-warning-700', sub: 'text-warning-700' },
  behind: { Icon: TrendingDown, on: 'border-warning-500 bg-warning-50', icon: 'bg-warning-50 text-warning-700', sub: 'text-warning-700' },
  track: { Icon: TrendingUp, on: 'border-info-700 bg-info-50', icon: 'bg-info-100 text-info-700', sub: 'text-info-700' },
  qual: { Icon: BadgeCheck, on: 'border-accent bg-accent-tint', icon: 'bg-accent-soft text-accent-strong', sub: 'text-accent-strong' },
  all: { Icon: Users, on: 'border-ink-600 bg-ink-100', icon: 'bg-ink-100 text-ink-700', sub: 'text-ink-700' },
}

function Tags({ r, group }: { r: Row; group: GroupKey }) {
  const tags: { label: string; cls: string }[] = []
  if (r.pendingLogs) tags.push({ label: `${r.pendingLogs} to verify`, cls: 'bg-gold-50 text-warning-700' })
  if (r.reportToReview) tags.push({ label: 'Report to review', cls: 'bg-info-100 text-info-700' })
  if (r.pendingRequired != null) tags.push({ label: `→ ${r.pendingRequired}h pending`, cls: 'bg-gold-50 text-warning-700' })
  if (qualified(r) && group !== 'qual') tags.push({ label: 'Qualified', cls: 'bg-accent-soft text-accent-strong' })
  else if (behind(r) && group !== 'behind' && !r.pendingLogs && !r.reportToReview) tags.push({ label: 'Behind', cls: 'bg-warning-50 text-warning-700' })
  return (
    <div className="flex flex-wrap justify-end gap-[5px]">
      {r.term !== 'in_progress' && r.term !== 'qualified' && <TermBadge badge={r.term} deficientHours={r.deficientHours} />}
      {tags.map((t) => <span key={t.label} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${t.cls}`}>{t.label}</span>)}
    </div>
  )
}

function Hours({ r }: { r: Row }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[11.5px]"><strong className="text-ink-900">{hrs(r.verified)}</strong><span className="text-ink-500">{pctOf(r)}%</span></div>
      <div className="mt-1 h-[5px] rounded-full bg-ink-100"><div className={`bar-grow-x h-full rounded-full ${barColor(r)}`} style={{ width: `${pctOf(r)}%` }} /></div>
    </div>
  )
}

const VIEW_BTN = 'h-8 rounded-[8px] px-3.5 text-[12.5px] font-semibold transition-colors'

/**
 * Supervisor → Students. "This term" is the working list (hours, pace, logs to verify) and
 * downloads the service-hours sheet for the DSA; "Term results" (?tab=term-results, the
 * report URL state) shows how a chosen term ended. This replaced the supervisor's
 * Analytics & Reports page.
 */
function StudentsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()
  const { notify } = useFeedback()
  const report = useReportUrlState()
  const termView = report.state.tab === 'term-results'

  const { data: periods = [] } = useQuery({
    queryKey: ['supervisor-report-periods'],
    queryFn: () => supervisorApi.getReportPeriods(),
    enabled: termView,
  })
  const term = resolveTerm(report.state.ay, report.state.sem, periods)

  const [q, setQ] = useState(params.get('q') ?? '')
  const initialGroup = params.get('group') as GroupKey | null
  const [group, setGroup] = useState<GroupKey>(GROUPS.some((g) => g.key === initialGroup) ? initialGroup! : 'action')
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('behind')
  const [page, setPage] = useState(0)
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [selId, setSelId] = useState<number | null>(null)
  const [reportFor, setReportFor] = useState<Row | null>(null)
  const [hoursFor, setHoursFor] = useState<Row | null>(null)
  const [docsFor, setDocsFor] = useState<Row | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['supervisor-students'], queryFn: () => attendanceApi.getSupervisorStudents() })
  const rows = useMemo(() => (((data as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[]).map(toRow), [data])

  const needle = q.trim().toLowerCase()
  const searched = rows.filter((r) => matchesSearch(r, needle))
  const inGroup = searched.filter(GROUPS.find((g) => g.key === group)!.test)
  const active = [...filters]
  const list = (active.length ? inGroup.filter((r) => active.some((k) => FILTERS[k].test(r))) : inGroup)
    .sort(SORTS.find((s) => s.key === sort)!.cmp)
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const cur = Math.min(page, pages - 1)
  const visible = list.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE)
  const selected = rows.find((r) => r.userId === selId) ?? null

  // Nothing needs action (and no group was asked for): open on everyone rather than an empty list.
  useEffect(() => {
    if (!isLoading && !initialGroup && group === 'action' && rows.length && !rows.some(GROUPS[0].test)) setGroup('all')
  }, [isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Start with the first student of the list selected (on wide screens), like the design.
  useEffect(() => {
    if (selId == null && visible.length && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) setSelId(visible[0].userId)
  }, [selId, visible])

  const offices = [...new Set(rows.map((r) => r.office).filter((o) => o && o !== '—'))]
  const toggle = (k: FilterKey) => { setFilters((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n }); setPage(0) }
  const clearFilters = () => { setFilters(new Set()); setPage(0) }
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const pick = (r: Row) => {
    // Below 1024px the panel opens as a bottom sheet over the list (StudentPanel's phone-sheet).
    setSelId(r.userId)
  }

  const setRequired = useMutation({
    mutationFn: (h: number) => attendanceApi.updateRequiredHours(hoursFor!.userId, h),
    onSuccess: (_r, h) => {
      notify({ title: 'Required hours updated', detail: `${hoursFor?.name ?? 'The student'} now needs ${h} hours this term.` })
      setHoursFor(null)
      for (const key of ['supervisor-students', 'student-summary', 'student-logs']) qc.invalidateQueries({ queryKey: [key] })
    },
  })

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.01em] text-ink-950">My Students</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {termView
              ? 'How each of your students ended the term: hours, verdict, end-of-term report, stipend and renewal.'
              : offices.length ? offices.join(' · ') : 'Recipients assigned to you'}
          </p>
        </div>
        {termView ? (
          <TermSelect term={term} periods={periods} onChange={(t) => report.setTerm(t.academic_year, t.semester)} />
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex h-[42px] w-full items-center sm:w-[300px] gap-2 rounded-xl border border-ink-900/[.12] bg-surface px-3 focus-within:border-accent">
              <Search className="h-[18px] w-[18px] text-ink-400" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Name, email or ID" aria-label="Search students"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-ink-900 placeholder-ink-400 focus:outline-none" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700"><X className="h-4 w-4" /></button>}
            </label>
            {/* The service-hours sheet for the DSA: every current student, verified/pending/remaining hours. */}
            <ExportButtons label="Hours sheet PDF" fallbackName="service-hours" disabled={!rows.length}
              summary={`${rows.length} ${rows.length === 1 ? 'student' : 'students'}`}
              download={(format) => reportsApi.export('supervisor', 'roster', { filters: {} }, format, { includeChart: false })} />
          </div>
        )}
      </div>

      <div className="flex w-fit items-center gap-1 rounded-[11px] bg-ink-100 p-1" role="tablist" aria-label="Students view">
        <button type="button" role="tab" aria-selected={!termView} onClick={() => router.push(pathname, { scroll: false })}
          className={`${VIEW_BTN} ${!termView ? 'bg-surface text-accent-strong shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
          This term
        </button>
        <button type="button" role="tab" aria-selected={termView} onClick={() => report.openTab('term-results')}
          className={`${VIEW_BTN} ${termView ? 'bg-surface text-accent-strong shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
          Term results
        </button>
      </div>

      {termView ? (
        <ReportExplorer role="supervisor" type="term-results" term={term} state={report.state} onChange={report.update} chart={false} />
      ) : (<>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {GROUPS.map((g) => {
          const on = group === g.key
          const look = GROUP_LOOK[g.key]
          return (
            <button key={g.key} type="button" onClick={() => { setGroup(g.key); setPage(0) }} aria-pressed={on}
              className={`flex items-center gap-2.5 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left transition-colors ${on ? look.on : 'border-ink-900/[.1] bg-surface hover:border-ink-300'}`}>
              <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] ${on ? 'bg-surface' : look.icon} ${look.sub}`}>
                <look.Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[19px] font-extrabold leading-tight text-ink-950">{isLoading ? '·' : searched.filter(g.test).length}</span>
                <span className={`block truncate text-[12px] font-semibold ${on ? look.sub : 'text-ink-500'}`}>{g.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <section className={`${CARD} min-w-0 overflow-visible`}>
          <div className="relative flex flex-wrap items-center gap-2.5 border-b border-ink-900/[.06] px-4 py-3">
            <div className="flex items-center gap-1 rounded-[10px] bg-ink-100 p-1">
              {([['list', List, 'List view'], ['cards', LayoutGrid, 'Card view']] as const).map(([v, Icon, label]) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} title={label} aria-label={label}
                  className={`flex h-7 w-8 items-center justify-center rounded-[7px] ${view === v ? 'bg-surface text-accent-strong shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort"
              className="h-[34px] rounded-[9px] border border-ink-200 bg-surface px-2.5 text-[12.5px] font-semibold text-ink-800 focus:border-accent focus:outline-none">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" data-filters-button onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}
              className={`flex h-[34px] items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] font-semibold ${
                active.length ? 'border-accent bg-accent-tint text-accent-strong' : 'border-ink-200 bg-surface text-ink-700'}`}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {active.length > 0 && <span className="pill-gold rounded-full px-[7px] py-px text-[11px] font-extrabold">{active.length}</span>}
            </button>
            {filtersOpen && (
              <FiltersPopover group={group} base={inGroup} active={filters} onToggle={toggle} onClear={clearFilters} onClose={closeFilters} shown={list.length} />
            )}
          </div>

          {active.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-900/[.06] bg-ink-50 px-4 py-2">
              {active.map((k) => (
                <button key={k} type="button" onClick={() => toggle(k)}
                  className="flex h-7 items-center gap-1 rounded-full border border-accent/30 bg-accent-tint pl-2.5 pr-1.5 text-[12px] font-semibold text-accent-strong">
                  {FILTERS[k].label} <X className="h-3.5 w-3.5" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="h-7 px-2 text-[12px] font-semibold text-ink-500 hover:text-ink-800">Clear all</button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div>
          ) : visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-500">{rows.length ? 'No students match.' : 'No students assigned yet.'}</p>
          ) : view === 'list' ? (
            <div>
              {visible.map((r) => {
                const on = r.userId === selId
                return (
                  <button key={r.userId} type="button" onClick={() => pick(r)} aria-pressed={on}
                    className={`grid w-full grid-cols-[minmax(0,1.5fr)_minmax(110px,1fr)] items-center gap-3.5 border-b border-ink-900/[.05] px-4 py-2.5 text-left transition-colors sm:grid-cols-[minmax(0,1.5fr)_minmax(130px,1fr)_auto] ${
                      on ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-ink-50'}`}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="h-[34px] w-[34px] rounded-full bg-accent-soft" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-ink-900">{r.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-500">{r.email}</span>
                      </span>
                    </span>
                    <Hours r={r} />
                    <span className="col-span-2 sm:col-span-1"><Tags r={r} group={group} /></span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              {visible.map((r) => {
                const on = r.userId === selId
                return (
                  <button key={r.userId} type="button" onClick={() => pick(r)} aria-pressed={on}
                    className={`flex flex-col gap-3 rounded-[14px] border p-3.5 text-left transition-colors ${on ? 'border-accent bg-accent-tint' : 'border-ink-900/[.08] hover:border-ink-300'}`}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="h-10 w-10 rounded-full bg-accent-soft" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink-900">{r.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-500">{r.office}</span>
                      </span>
                    </span>
                    <Hours r={r} />
                    <Tags r={r} group={group} />
                  </button>
                )
              })}
            </div>
          )}

          {list.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 text-[12.5px] text-ink-500">
              <span>{cur * PER_PAGE + 1}–{Math.min(list.length, cur * PER_PAGE + PER_PAGE)} of {list.length}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0} aria-label="Previous page"
                  className="tap flex h-8 w-8 items-center justify-center rounded-[9px] border border-ink-200 bg-surface text-ink-700 disabled:text-ink-300">
                  <ChevronLeft className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1} aria-label="Next page"
                  className="tap flex h-8 w-8 items-center justify-center rounded-[9px] border border-ink-200 bg-surface text-ink-700 disabled:text-ink-300">
                  <ChevronRight className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          )}
        </section>

        <div id="student-panel" className="scroll-mt-4 lg:sticky lg:top-4">
          {selected ? (
            <StudentPanel row={selected} onClose={() => setSelId(null)}
              onReport={() => setReportFor(selected)} onRequired={() => setHoursFor(selected)} onDocs={() => setDocsFor(selected)} />
          ) : !isLoading && rows.length > 0 ? <EmptyPanel /> : null}
        </div>
      </div>
      </>)}

      {reportFor && <TermReportReviewModal studentId={reportFor.userId} studentName={reportFor.name} onClose={() => setReportFor(null)} />}
      {docsFor && <StudentDocumentsModal student={{ userId: docsFor.userId, name: docsFor.name }} onClose={() => setDocsFor(null)} />}
      {hoursFor && (
        <RequiredHoursModal current={hoursFor.required} isPending={setRequired.isPending}
          error={setRequired.isError ? ((setRequired.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setHoursFor(null)} onSubmit={(h) => setRequired.mutate(h)} />
      )}
    </div>
  )
}

export default function SupervisorStudentsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-ink-100" />}>
      <StudentsPage />
    </Suspense>
  )
}
