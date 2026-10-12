'use client'

import { useState, type ReactNode } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Building2, X, MapPin, Sparkles, Target, ChevronLeft, ChevronRight, Check, CheckCircle2,
  AlertTriangle, Users, ArrowRight,
} from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { applicationsApi } from '@/lib/api/applications.api'
import { ManualHoursModal, RequiredHoursModal } from '@/components/attendance/HoursModals'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { TERM_FILTERS, TermBadge, type TermFilter } from '@/components/shared/TermBadge'
import { formatHours } from '@/lib/utils/formatHours'
import type { Application } from '@/types/application.types'
import type { Assignment, Office } from '@/types/assignment.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

/**
 * Admin → Assignments (layout "SWAP Admin Assignments v2"): two tabs.
 * "Needs an office" — approved applicants without a placement for their term (server-side
 * `unassigned` filter); pick one, choose an office (its supervisor is picked automatically, or
 * from a short list when it has several), set the hours and dates, confirm.
 * "Assigned" — every placement with its hours, term verdict and Bonus / Hours / Move actions.
 */

const GREEN = 'var(--color-accent)'
const RED = 'var(--color-red-accent)'
const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'

// Soft avatar palettes (bg / fg pairs).
const AV: [string, string][] = [
  ['var(--color-brand-100)', 'var(--color-brand-700)'], ['var(--color-info-50)', 'var(--color-info-500)'], ['var(--color-success-50)', 'var(--color-success-600)'],
  ['var(--color-gold-50)', 'var(--color-gold-600)'], ['var(--color-violet-100)', 'var(--color-violet-600)'], ['var(--color-danger-50)', 'var(--color-danger-500)'],
]
const av = (i: number) => AV[((i % AV.length) + AV.length) % AV.length]
const today = () => new Date().toISOString().slice(0, 10)
// An office at its limit takes no new placements or moves (the backend refuses with the same rule).
const isFull = (o: Office) => (o.active_recipients ?? 0) >= (o.max_recipients || 0)
const firstError = (e: unknown, fallback: string) => {
  const err = e as { message?: string; errors?: Record<string, string[]> }
  return (err?.errors && Object.values(err.errors)[0]?.[0]) || err?.message || fallback
}
const fieldCls = 'h-10 w-full rounded-xl border border-ink-200 bg-ink-50/60 px-3 text-sm text-ink-900 focus:border-accent focus:bg-surface focus:outline-none'

type Tab = 'queue' | 'assigned'

function Pager({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (p: number) => void }) {
  if (lastPage <= 1) return null
  const btn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 hover:text-accent disabled:opacity-40'
  return (
    <div className="flex items-center justify-between border-t border-ink-900/[.06] px-4 py-2.5">
      <p className="text-xs text-ink-500">Page {page} of {lastPage}</p>
      <div className="flex gap-1.5">
        <button className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= lastPage} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

export default function AdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const { notify } = useFeedback()
  const [tab, setTab] = useState<Tab>('queue')
  const [search, setSearch] = useState('')
  const [queuePage, setQueuePage] = useState(1)
  const [assignedPage, setAssignedPage] = useState(1)
  const [termFilter, setTermFilter] = useState<TermFilter>('all')
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const [editFor, setEditFor] = useState<Assignment | null>(null)
  const [bonusFor, setBonusFor] = useState<Assignment | null>(null)
  const [hoursFor, setHoursFor] = useState<Assignment | null>(null)

  // Assign-panel fields
  const [officeId, setOfficeId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [requiredHours, setRequiredHours] = useState('200')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState('')

  // Move (change office / supervisor) fields
  const [editOfficeId, setEditOfficeId] = useState('')
  const [editSupervisorId, setEditSupervisorId] = useState('')
  // "Change supervisor only": same office, another of its supervisors.
  const [supOnly, setSupOnly] = useState(false)

  const q = search.trim()
  const searchParam: Record<string, string> = q ? { search: q } : {}

  // ── Needs an office: approved, no active placement for their term ─────────
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['admin-approved-applications', 'unassigned', q, queuePage],
    queryFn: () => applicationsApi.adminListApplications({ unassigned: '1', page: String(queuePage), ...searchParam }),
  })
  const { data: queueTotal } = useQuery({
    queryKey: ['admin-approved-applications', 'unassigned', 'count'],
    queryFn: () => applicationsApi.adminListApplications({ unassigned: '1', page: '1' }).then((r) => r.meta?.total ?? 0),
  })
  const queue = queueData?.data ?? []

  // ── Assigned: one page at a time, filtered by term verdict on the server ──
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['admin-assignments', termFilter, q, assignedPage],
    queryFn: () => assignmentsApi.getAssignments({
      page: String(assignedPage), ...searchParam, ...(termFilter !== 'all' && { term: termFilter }),
    }),
    enabled: tab === 'assigned',
  })
  const termCounts = useQueries({
    queries: TERM_FILTERS.map((f) => ({
      queryKey: ['admin-assignments', 'count', f.value],
      queryFn: () => assignmentsApi.getAssignments({ page: '1', ...(f.value !== 'all' && { term: f.value }) }).then((r) => r.meta?.total ?? 0),
    })),
  })
  const assignments = assignedData?.data ?? []

  // Every active office with its supervisors, in one list.
  const { data: officesData } = useQuery({
    queryKey: ['admin-offices-list', 'all'],
    queryFn: () => assignmentsApi.getOffices({ per_page: '100' }),
  })
  const offices = (officesData?.data ?? []).filter((o) => o.is_active)
  const officeById = (id: string) => offices.find((o) => String(o.id) === id)
  const supervisorsFor = (id: string) => officeById(id)?.supervisors ?? []

  // The recipient loaded into the assign panel.
  const selected: Application | null = queue.find((a) => a.id === selectedAppId) ?? queue[0] ?? null
  const terms = Array.from(new Set(queue.map((a) => `${a.academic_year} · ${a.semester}`)))

  // Picking an office auto-selects its supervisor when there's exactly one; otherwise the admin picks.
  function pickOffice(id: string, setOffice: (v: string) => void, setSupervisor: (v: string) => void) {
    setOffice(id)
    const sups = supervisorsFor(id)
    setSupervisor(sups.length === 1 ? String(sups[0].id) : '')
  }

  function selectRecipient(app: Application) {
    setSelectedAppId(app.id)
    setOfficeId('')
    setSupervisorId('')
    setRequiredHours('200')
    setStartDate(today())
    setEndDate('')
  }

  const changeSearch = (v: string) => { setSearch(v); setQueuePage(1); setAssignedPage(1) }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
    queryClient.invalidateQueries({ queryKey: ['admin-approved-applications'] })
    queryClient.invalidateQueries({ queryKey: ['admin-offices-list'] })
  }

  // Errors stay inside the hours dialogs; a save closes the dialog and pops out.
  const addBonus = useMutation({
    mutationFn: (v: { hours: number; date: string; reason: string }) => assignmentsApi.addManualHours(bonusFor!.id, v),
    onSuccess: (_r, v) => {
      notify({ title: 'Bonus hours sent for approval', detail: `${v.hours}h for ${bonusFor?.user?.name ?? 'the recipient'} — the supervisor verifies them.` })
      setBonusFor(null)
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
    },
  })

  const setReq = useMutation({
    mutationFn: (hours: number) => assignmentsApi.requestRequiredHours(hoursFor!.id, hours),
    onSuccess: (_r, hours) => {
      notify({ title: 'Change requested', detail: `The supervisor approves or rejects the change to ${hours} required hours.` })
      setHoursFor(null)
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
    },
  })

  const assign = useMutation({
    mutationFn: () =>
      assignmentsApi.createAssignment({
        user_id: selected!.user_id,
        office_id: Number(officeId),
        supervisor_id: Number(supervisorId),
        academic_year: selected!.academic_year,
        semester: selected!.semester,
        required_hours: Number(requiredHours),
        start_date: startDate,
        ...(endDate && { end_date: endDate }),
      }),
    onSuccess: () => {
      const name = selected?.user?.name ?? 'Recipient'
      const oName = officeById(officeId)?.name ?? 'the office'
      invalidate()
      setSelectedAppId(null)
      setOfficeId('')
      setSupervisorId('')
      setStartDate(today())
      setEndDate('')
      notify({ title: 'Recipient assigned', detail: `${name} is assigned to ${oName}. They're notified by email.` })
    },
  })

  const edit = useMutation({
    mutationFn: () =>
      assignmentsApi.updateAssignment(editFor!.id, { office_id: Number(editOfficeId), supervisor_id: Number(editSupervisorId) }),
    onSuccess: () => {
      invalidate()
      notify({ title: 'Placement updated', detail: `${editFor?.user?.name ?? 'The recipient'} has been notified of the change.` })
      setEditFor(null)
    },
  })

  // Opens with nothing picked: the current office can't be chosen again (the API refuses it too).
  function openMove(a: Assignment) {
    setEditFor(a)
    setSupOnly(false)
    setEditOfficeId('')
    setEditSupervisorId('')
  }

  const chosenOffice = officeById(officeId)
  const panelSups = supervisorsFor(officeId)
  const chosenSup = panelSups.find((s) => String(s.id) === supervisorId)
  const canAssign = !!selected && !!officeId && !!supervisorId && !!startDate && Number(requiredHours) > 0 && !assign.isPending

  const assignError = assign.isError ? firstError(assign.error, 'Could not create the assignment. Check the fields and try again.') : null
  const allFull = offices.length > 0 && offices.every(isFull)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Assignments</h1>
          <p className="mt-1 text-sm text-ink-500">Give approved students an office, then follow their hours.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            placeholder="Search name, email or student ID"
            className="h-10 w-full rounded-xl border border-ink-200 bg-surface pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-ink-900/[.08]" role="tablist">
        {([
          ['queue', 'Needs an office', queueTotal],
          ['assigned', 'Assigned', termCounts[0]?.data],
        ] as const).map(([value, label, count]) => {
          const active = tab === value
          return (
            <button key={value} role="tab" aria-selected={active} onClick={() => setTab(value)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-0.5 pb-2.5 text-[14px] font-semibold transition-colors ${
                active ? 'border-accent text-accent' : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}>
              {label}
              <span className={`rounded-full px-2 py-px text-[11px] font-bold ${
                active ? 'bg-accent text-white' : value === 'queue' && count ? 'bg-gold-100 text-gold-700' : 'bg-ink-100 text-ink-600'
              }`}>{count ?? '·'}</span>
            </button>
          )
        })}
      </div>

      {tab === 'queue' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* Waiting list */}
          <div className={`${CARD} overflow-hidden`}>
            <p className="border-b border-ink-900/[.06] px-4 py-3 text-[12.5px] font-semibold text-ink-600">
              {terms.length === 1 ? `Approved for ${terms[0]}, waiting for an office` : 'Approved, waiting for an office'}
            </p>
            {queueLoading ? (
              <div className="space-y-2 p-3.5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[54px] animate-pulse rounded-xl bg-ink-200/50" />)}</div>
            ) : queue.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" />
                <p className="mt-2.5 text-[13.5px] font-semibold text-ink-700">{q ? 'No match' : 'All caught up'}</p>
                <p className="mt-1 text-[12.5px] text-ink-400">{q ? <>No one waiting matches “{search}”.</> : 'Every approved student has an office.'}</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-900/[.06]">
                {queue.map((app, i) => {
                  const [bg, fg] = av(i)
                  const active = selected?.id === app.id
                  return (
                    <li key={app.id}>
                      <button onClick={() => selectRecipient(app)} aria-current={active}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-ink-50/70'}`}>
                        <UserAvatar name={app.user?.name} avatarUrl={app.user?.avatar_url}
                          className="h-9 w-9 rounded-full text-[12.5px] font-bold" style={{ background: bg, color: fg }} />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-950">{app.user?.name ?? '—'}</span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-400">
                            {app.user?.profile?.student_id_number ? `ID ${app.user.profile.student_id_number} · ` : ''}{app.user?.email ?? '—'}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 flex-none" style={{ color: active ? GREEN : 'var(--text-ink-300)' }} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Pager page={queuePage} lastPage={queueData?.meta?.last_page ?? 1} onPage={(p) => { setQueuePage(p); setSelectedAppId(null) }} />
          </div>

          {/* Assign panel */}
          <div className={`${CARD} overflow-hidden lg:sticky lg:top-[88px]`}>
            <div className="px-6 py-4 text-white"
              style={{ background: 'var(--hero-gradient)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-gold-accent">Assigning</p>
              {selected ? (
                <div className="mt-1.5 flex items-center gap-3">
                  <UserAvatar name={selected.user?.name} avatarUrl={selected.user?.avatar_url}
                    className="h-10 w-10 rounded-full border border-white/25 bg-white/15 text-[14px] font-bold text-white" />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[16px] font-bold">{selected.user?.name ?? '—'}</p>
                    <p className="truncate text-[12px] text-white/75">
                      {selected.user?.profile?.student_id_number ? `ID ${selected.user.profile.student_id_number} · ` : ''}{selected.user?.email ?? ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-white/80">No one is waiting.</p>
              )}
            </div>

            {selected ? (
              <>
                <div className="space-y-5 px-6 py-5">
                  {/* 1. Office */}
                  <section>
                    <p className="mb-2.5 text-[13px] font-bold text-ink-900">1. Choose an office</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {offices.map((o) => (
                        <OfficeCard key={o.id} office={o} on={officeId === String(o.id)}
                          onPick={() => pickOffice(String(o.id), setOfficeId, setSupervisorId)} />
                      ))}
                      {allFull && (
                        <p className="flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[12.5px] font-medium text-danger-700 sm:col-span-2">
                          <AlertTriangle className="h-4 w-4 flex-none" /> Every office is full. Raise a limit on the Offices page.
                        </p>
                      )}
                      {offices.length === 0 && (
                        <p className="rounded-xl border border-dashed border-ink-300 px-3.5 py-4 text-center text-xs text-ink-400 sm:col-span-2">
                          No offices yet. Add one on the Offices page.
                        </p>
                      )}
                    </div>
                    {officeId && panelSups.length === 1 && (
                      <p className="mt-2.5 flex items-center gap-2 text-[12.5px] text-ink-600">
                        <Users className="h-4 w-4 text-accent" /> Supervisor: <b className="text-ink-900">{panelSups[0].name}</b>
                      </p>
                    )}
                    {officeId && panelSups.length > 1 && (
                      <label className="mt-2.5 block">
                        <span className="mb-1 block text-[12px] font-semibold text-ink-600">This office has {panelSups.length} supervisors. Pick one:</span>
                        <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={fieldCls}>
                          <option value="">Select supervisor…</option>
                          {panelSups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </label>
                    )}
                  </section>

                  {/* 2. Schedule */}
                  <section>
                    <p className="mb-2.5 text-[13px] font-bold text-ink-900">2. Set the schedule</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-ink-600">Required hours</span>
                        <input type="number" min={1} max={500} value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)} className={fieldCls} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-ink-600">Start date</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-ink-600">End date <span className="font-normal text-ink-400">(optional)</span></span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} />
                      </label>
                    </div>
                  </section>

                  {assignError && <p className="text-[12.5px] font-medium text-danger-700">{assignError}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/[.06] bg-ink-50/50 px-6 py-4">
                  <p className="min-w-0 flex-1 text-[12.5px] text-ink-600">
                    {chosenOffice
                      ? <>{selected.user?.name ?? 'Recipient'} <ArrowRight className="inline h-3.5 w-3.5" /> <b>{chosenOffice.name}</b>
                          {chosenSup ? ` with ${chosenSup.name}` : ''}, {requiredHours || 0}h from {startDate || '—'}</>
                      : 'Choose an office to continue.'}
                  </p>
                  <button onClick={() => assign.mutate()} disabled={!canAssign}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,129,95,.25)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                    style={{ background: GREEN }}>
                    <Check className="h-4 w-4" strokeWidth={2.5} /> {assign.isPending ? 'Assigning…' : 'Confirm assignment'}
                  </button>
                </div>
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" />
                <p className="mt-2.5 text-sm font-semibold text-ink-950">All caught up</p>
                <p className="mt-1 text-xs text-ink-400">Every approved student has an office.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Term verdict chips */}
          <div className="flex flex-wrap gap-2">
            {TERM_FILTERS.map((f, i) => {
              const active = termFilter === f.value
              return (
                <button key={f.value} onClick={() => { setTermFilter(f.value); setAssignedPage(1) }} aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active ? 'border-accent bg-accent text-white' : 'border-ink-900/[.08] bg-surface text-ink-600 hover:text-accent'
                  }`}>
                  {f.label}
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-bold ${active ? 'bg-white/20' : 'bg-ink-100'}`}>{termCounts[i]?.data ?? '·'}</span>
                </button>
              )
            })}
          </div>

          <div className={`${CARD} overflow-hidden`}>
            {assignedLoading ? (
              <div className="space-y-2 p-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-200/50" />)}</div>
            ) : assignments.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-ink-400">
                {q ? <>No one assigned matches “{search}”.</> : termFilter !== 'all' ? 'No placements with this term status.' : 'No placements yet.'}
              </p>
            ) : (
              <>
                {/* Wide screens: table */}
                <table className="hidden w-full text-left text-[13px] md:table">
                  <thead>
                    <tr className="border-b border-ink-900/[.06] text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">
                      <th className="px-4 py-3 font-bold">Recipient</th>
                      <th className="px-4 py-3 font-bold">Office</th>
                      <th className="px-4 py-3 font-bold">Hours</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-900/[.06]">
                    {assignments.map((a, i) => (
                      <tr key={a.id} className="hover:bg-ink-50/50">
                        <td className="px-4 py-3"><Who a={a} i={i} /></td>
                        <td className="px-4 py-3"><OfficeName a={a} /></td>
                        <td className="w-[220px] px-4 py-3"><HoursBar a={a} /></td>
                        <td className="px-4 py-3"><Verdict a={a} /></td>
                        <td className="px-4 py-3"><Actions a={a} onBonus={setBonusFor} onHours={setHoursFor} onMove={openMove} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Phones: stacked cards */}
                <ul className="divide-y divide-ink-900/[.06] md:hidden">
                  {assignments.map((a, i) => (
                    <li key={a.id} className="space-y-2.5 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2"><Who a={a} i={i} /><Verdict a={a} /></div>
                      <OfficeName a={a} />
                      <HoursBar a={a} />
                      <Actions a={a} onBonus={setBonusFor} onHours={setHoursFor} onMove={openMove} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Pager page={assignedPage} lastPage={assignedData?.meta?.last_page ?? 1} onPage={setAssignedPage} />
          </div>
        </div>
      )}

      {/* Move: change office / supervisor */}
      {editFor && (
        <div className="sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditFor(null)}>
          <div role="dialog" aria-modal="true" aria-label="Move to another office"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[18px] bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-950">Move to another office</h2>
                <p className="text-sm text-ink-500">{editFor.user?.name} · now at {editFor.office?.name ?? '—'}</p>
              </div>
              <button onClick={() => setEditFor(null)} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">Office</span>
                {supOnly ? (
                  <p className={`${fieldCls} flex items-center bg-ink-100 text-ink-600`}>{editFor.office?.name ?? '—'} (current)</p>
                ) : (
                  <select value={editOfficeId} onChange={(e) => pickOffice(e.target.value, setEditOfficeId, setEditSupervisorId)} className={fieldCls}>
                    <option value="">Select office…</option>
                    {offices.map((o) => {
                      const current = o.id === editFor.office_id
                      return (
                        <option key={o.id} value={o.id} disabled={current || o.ready === false || isFull(o)}>
                          {o.name}{current ? ' (current)' : o.ready === false ? ' (needs setup)' : isFull(o) ? ' (full)' : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">Supervisor</span>
                <select value={editSupervisorId} onChange={(e) => setEditSupervisorId(e.target.value)}
                  disabled={!editOfficeId || (!supOnly && supervisorsFor(editOfficeId).length <= 1)} className={`${fieldCls} disabled:bg-ink-100 disabled:text-ink-500`}>
                  <option value="">{!editOfficeId ? 'Select an office first' : 'Select supervisor…'}</option>
                  {supervisorsFor(editOfficeId).map((s) => {
                    const current = supOnly && s.id === editFor.supervisor_id
                    return <option key={s.id} value={s.id} disabled={current}>{s.name}{current ? ' (current)' : ''}</option>
                  })}
                </select>
              </label>
            </div>
            {supervisorsFor(String(editFor.office_id)).length > 1 && (
              <button type="button" onClick={() => {
                const next = !supOnly
                setSupOnly(next)
                setEditOfficeId(next ? String(editFor.office_id) : '')
                setEditSupervisorId('')
              }} className="mt-2 text-xs font-semibold text-accent-strong hover:underline">
                {supOnly ? 'Move to another office instead' : 'Change supervisor only'}
              </button>
            )}

            <p className="mt-3 text-xs text-ink-500">
              The recipient clocks in at the new office&apos;s QR from now on. Hours already rendered are unaffected.
            </p>
            {edit.isError && <p className="mt-2 text-xs text-danger-700">{firstError(edit.error, 'Could not update the placement. Please try again.')}</p>}

            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={() => setEditFor(null)} className="h-10 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-600 hover:bg-ink-50">Cancel</button>
              <button onClick={() => edit.mutate()} disabled={edit.isPending || !editOfficeId || !editSupervisorId}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-45" style={{ background: GREEN }}>
                <MapPin className="h-4 w-4" /> {edit.isPending ? 'Saving…' : supOnly ? 'Change supervisor' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bonusFor && (
        <ManualHoursModal
          studentName={bonusFor.user?.name}
          requiresApproval
          isPending={addBonus.isPending}
          error={addBonus.isError ? ((addBonus.error as { message?: string })?.message ?? 'Could not add hours.') : null}
          onClose={() => setBonusFor(null)}
          onSubmit={(v) => addBonus.mutate(v)}
        />
      )}
      {hoursFor && (
        <RequiredHoursModal
          current={hoursFor.required_hours}
          requiresApproval
          isPending={setReq.isPending}
          error={setReq.isError ? ((setReq.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setHoursFor(null)}
          onSubmit={(h) => setReq.mutate(h)}
        />
      )}
    </div>
  )
}

/** An office to choose: radio, capacity bar ("n of cap spots", open / over), no-supervisor warning. */
function OfficeCard({ office: o, on, onPick }: { office: Office; on: boolean; onPick: () => void }) {
  const active = o.active_recipients ?? 0
  const cap = o.max_recipients || 0
  const left = cap - active
  const pct = cap > 0 ? Math.min(100, (active / cap) * 100) : 100
  // Not set up (no supervisor, map pin or clock-in area): the API refuses new placements.
  const noSup = !(o.supervisors?.length) || o.ready === false
  const full = isFull(o)
  return (
    <button type="button" onClick={onPick} disabled={noSup || full} aria-pressed={on}
      title={full ? 'This office is full. Raise its limit on the Offices page to add more.' : noSup ? 'Finish setting up this office on the Offices page first' : undefined}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        on ? 'border-accent bg-accent-tint ring-1 ring-accent' : 'border-ink-900/[.08] bg-surface enabled:hover:border-accent/40'
      }`}>
      <span className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 ${on ? 'border-accent' : 'border-ink-300'}`}>
        {on && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
          <Building2 className="h-3.5 w-3.5 flex-none text-ink-400" /><span className="truncate">{o.name}</span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink-100">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: left <= 0 ? RED : GREEN }} />
        </span>
        <span className="mt-1 flex justify-between gap-2 text-[11.5px]">
          <span className="text-ink-500">{active} of {cap} spots</span>
          <span className="font-semibold" style={{ color: left <= 0 ? RED : GREEN }}>
            {left < 0 ? `${-left} over · Full` : left === 0 ? 'Full' : `${left} open`}
          </span>
        </span>
        {noSup && (
          <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-warning-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs setup on the Offices page
          </span>
        )}
      </span>
    </button>
  )
}

function Who({ a, i }: { a: Assignment; i: number }) {
  const [bg, fg] = av(i)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar name={a.user?.name} avatarUrl={a.user?.avatar_url} className="h-8 w-8 rounded-full text-[12px] font-bold" style={{ background: bg, color: fg }} />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold text-ink-950">{a.user?.name ?? '—'}</p>
        {a.user?.profile?.student_id_number && <p className="font-mono text-[11px] text-ink-500">ID {a.user.profile.student_id_number}</p>}
      </div>
    </div>
  )
}

function OfficeName({ a }: { a: Assignment }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-700">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: av(a.office_id)[1] }} />
      <span className="truncate">{a.office?.name ?? '—'}</span>
    </span>
  )
}

function HoursBar({ a }: { a: Assignment }) {
  const pct = a.required_hours > 0 ? Math.min(100, (a.verified_hours / a.required_hours) * 100) : 0
  const extras: ReactNode[] = []
  if (a.carried_over_hours) {
    extras.push(<span key="c" className="rounded-full bg-violet-50 px-1.5 py-px text-[10.5px] font-semibold text-violet-700"
      title={`Unfinished makeup hours from ${a.carried_from_term ?? 'the previous term'}`}>+{a.carried_over_hours}h carried</span>)
  }
  if (a.pending_required_hours != null) {
    extras.push(<span key="p" className="rounded-full bg-gold-50 px-1.5 py-px text-[10.5px] font-semibold text-warning-700"
      title="Awaiting supervisor approval">→ {a.pending_required_hours}h pending</span>)
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold text-ink-900">{formatHours(a.verified_hours)} <span className="font-normal text-ink-400">/ {a.required_hours}h</span></span>
        <span className="text-ink-400">{Math.round(pct)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GREEN }} />
      </div>
      {extras.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{extras}</div>}
    </div>
  )
}

function Verdict({ a }: { a: Assignment }) {
  if (a.term_badge && a.term_badge !== 'in_progress') return <TermBadge badge={a.term_badge} deficientHours={a.deficient_hours} />
  const active = a.status === 'active'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={active ? { background: 'var(--color-success-50)', color: 'var(--text-success-800)' } : { background: 'var(--color-ink-100)', color: 'var(--text-ink-500)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? 'var(--color-success-600)' : 'var(--color-ink-350)' }} />
      {active ? 'In progress' : a.status === 'completed' ? 'Completed' : 'Suspended'}
    </span>
  )
}

function Actions({ a, onBonus, onHours, onMove }: {
  a: Assignment; onBonus: (a: Assignment) => void; onHours: (a: Assignment) => void; onMove: (a: Assignment) => void
}) {
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg border border-ink-900/[.08] bg-surface px-2.5 text-[12px] font-semibold transition-colors hover:bg-ink-50'
  return (
    <div className="flex gap-1.5 md:justify-end">
      <button onClick={() => onBonus(a)} className={`${btn} text-gold-700`} title="Add bonus hours (the supervisor verifies them)"><Sparkles className="h-3.5 w-3.5" /> Bonus</button>
      <button onClick={() => onHours(a)} className={`${btn} text-info-500`} title="Ask to change the required hours"><Target className="h-3.5 w-3.5" /> Hours</button>
      <button onClick={() => onMove(a)} className={`${btn} text-accent`} title="Move to another office"><MapPin className="h-3.5 w-3.5" /> Move</button>
    </div>
  )
}
