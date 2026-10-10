'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search, ArrowRight, CheckCircle2, Inbox, Clock, CalendarClock, XCircle, CheckCircle, CalendarCheck,
  ChevronLeft, ChevronRight, Video, Users, MapPin, Ban, BadgeCheck, RefreshCw, Layers,
  FileText, X, UserPlus, Building2,
} from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { ApplicationPeriodToggle } from '@/components/admin/ApplicationPeriodToggle'
import { RenewalReadinessPanel } from '@/components/admin/RenewalReadinessPanel'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatDate, formatDateTime } from '@/lib/utils/formatDate'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { rejectConfirm, notEligibleRemarks } from '@/lib/utils/rejectConfirm'
import type { ApplicationStatus, Interview } from '@/types/application.types'

/**
 * Admin → Applications (layout "SWAP Admin Applications v2"): status tabs with counts, the
 * queue on the left (search, type switch, paging) and the picked student on the right —
 * facts, last semester's record for a renewal or the interview for a new applicant, documents,
 * and the decision footer. Approved applicants leave this queue for Assignments.
 */

const DSA_OFFICE = 'Office of the Dean of Student Affairs (DSA)'
const GREEN = '#17815F'
const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-white shadow-[0_1px_3px_rgba(20,40,30,.05)]'

const AVATARS: [string, string][] = [
  ['#E3EEE5', '#1F5B3A'], ['#F3F7FB', '#4A82B8'], ['#EFF8F4', '#1F8163'],
  ['#FDF8E4', '#9A7412'], ['#EFE9F7', '#6B4E9A'], ['#FEF3F2', '#E2483B'], ['#F3F7FB', '#234A70'],
]
const avatar = (id: number) => AVATARS[id % AVATARS.length]

const STATUS_META: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  submitted: { label: 'Submitted', bg: '#EEF4FA', fg: '#2F5D8A', dot: '#4A82B8' },
  under_review: { label: 'Under review', bg: '#FFF7E6', fg: '#9A5B06', dot: '#F59E0B' },
  interview_scheduled: { label: 'Interview set', bg: '#F1ECF8', fg: '#5A3E86', dot: '#6B4E9A' },
  approved: { label: 'Approved', bg: '#EAF6F0', fg: '#145643', dot: '#1F8163' },
  rejected: { label: 'Rejected', bg: '#FDEDEC', fg: '#B42318', dot: '#E2483B' },
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.submitted
  return (
    <span className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: m.bg, color: m.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

// Status tabs: "All" is every application still in play (approved ones moved to Assignments).
const STATUS_TABS: { status: ApplicationStatus | null; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { status: null, label: 'All', Icon: Layers },
  { status: 'submitted', label: 'Submitted', Icon: Inbox },
  { status: 'under_review', label: 'Under review', Icon: Clock },
  { status: 'interview_scheduled', label: 'Interview set', Icon: CalendarClock },
  { status: 'rejected', label: 'Rejected', Icon: XCircle },
]

type TypeFilter = 'all' | 'new' | 'renewal'
const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'new', label: 'New' },
  { value: 'renewal', label: 'Renewal' },
]

export default function AdminApplicationsPage() {
  const queryClient = useQueryClient()

  // queue / filter state
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  // Links can open a tab directly (the dashboard's "renewals ready to approve" → ?type=renewal).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('type')
    if (t === 'renewal' || t === 'new') setTypeFilter(t)
  }, [])
  const typeParam: Record<string, string> = typeFilter === 'all' ? {} : { type: typeFilter }
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // review-panel form state
  const [interviewDate, setInterviewDate] = useState('')
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person')
  const [location, setLocation] = useState(DSA_OFFICE)
  const [remarks, setRemarks] = useState('')
  const { notify, notifyError, confirm } = useFeedback()
  const [dialog, setDialog] = useState<'schedule' | 'reschedule' | null>(null)
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)

  // ── queue list ───────────────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['admin-applications', typeFilter, statusFilter ?? 'active', search, page],
    queryFn: () =>
      applicationsApi.adminListApplications({
        page: String(page),
        ...typeParam,
        ...(search && { search }),
        // Approved applicants graduate to the Assignments queue, so "All" hides them.
        ...(statusFilter ? { status: statusFilter } : { exclude_status: 'approved' }),
      }),
  })
  const applications = listData?.data ?? []
  const meta = listData?.meta

  // ── per-tab counts (within the selected type, so they agree with the list) ─
  const countQueries = useQueries({
    queries: STATUS_TABS.map((t) => ({
      queryKey: ['admin-applications', 'count', typeFilter, t.status ?? 'active'],
      queryFn: () =>
        applicationsApi.adminListApplications({
          page: '1', ...typeParam, ...(t.status ? { status: t.status } : { exclude_status: 'approved' }),
        }).then((r) => r.meta?.total ?? 0),
    })),
  })

  // Renewals waiting for a decision (they stay "Submitted" until approved or rejected).
  const { data: renewalsWaiting } = useQuery({
    queryKey: ['admin-applications', 'count', 'renewal', 'waiting'],
    queryFn: () =>
      applicationsApi.adminListApplications({ type: 'renewal', status: 'submitted', page: '1' }).then((r) => r.meta?.total ?? 0),
  })

  // The active selection defaults to the first item in the current queue.
  const activeId = selectedId ?? applications[0]?.id ?? null

  const { data: selected, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-application', activeId],
    queryFn: () => applicationsApi.adminGetApplication(activeId!),
    enabled: activeId != null,
  })

  // Reset the form whenever the selected applicant changes so values never leak between them.
  useEffect(() => {
    setInterviewDate('')
    setMode('in_person')
    setLocation(DSA_OFFICE)
    setRemarks('')
    setDialog(null)
  }, [activeId])

  // A renewal the supervisor marked not eligible can only be rejected: start the remarks
  // with the reason, so Reject is ready (the admin can still edit them).
  const suggestedRemarks = selected?.id === activeId && selected?.type === 'renewal' && selected?.status === 'submitted'
    ? notEligibleRemarks(selected?.renewal_readiness)
    : null
  useEffect(() => {
    if (suggestedRemarks) setRemarks((current) => current || suggestedRemarks)
  }, [suggestedRemarks])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
    queryClient.invalidateQueries({ queryKey: ['admin-application', activeId] })
  }

  // The backend refuses with a message (a window rule, a missing link, a state conflict) — show it verbatim.
  const showError = (err: unknown) => notifyError(err, 'That didn\'t go through')

  // Online interviews carry their join link in meeting_link (required by the backend).
  const interviewPayload = () =>
    mode === 'online'
      ? { scheduled_at: interviewDate, mode, meeting_link: location.trim() }
      : { scheduled_at: interviewDate, mode, location }

  const markReview = useMutation({
    mutationFn: () => applicationsApi.adminMarkUnderReview(activeId!),
    onSuccess: () => {
      refresh()
      notify({ title: 'Moved to Under review', detail: 'You can now set the interview.' })
    },
    onError: showError,
  })

  const scheduleInterview = useMutation({
    mutationFn: () => applicationsApi.adminScheduleInterview(activeId!, interviewPayload()),
    onSuccess: () => {
      refresh()
      setInterviewDate('')
      setDialog(null)
      notify({ title: 'Interview set', detail: 'The applicant has been notified.' })
    },
    onError: showError,
  })

  const reschedule = useMutation({
    mutationFn: () => applicationsApi.adminRescheduleInterview(activeId!, interviewPayload()),
    onSuccess: () => {
      refresh()
      setInterviewDate('')
      setDialog(null)
      notify({ title: 'Interview rescheduled', detail: 'The applicant has been notified of the new time.' })
    },
    onError: showError,
  })

  const markNoShow = useMutation({
    mutationFn: () => applicationsApi.adminMarkInterviewNoShow(activeId!),
    onSuccess: () => {
      refresh()
      notify({ tone: 'info', title: 'Marked as a no-show', detail: 'You can reschedule the interview or reject with remarks.' })
    },
    onError: showError,
  })

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      applicationsApi.adminDecideApplication(activeId!, { decision, remarks }),
    onSuccess: (data, decision) => {
      // Keep the decided applicant in view so the admin sees the confirmation.
      setSelectedId(activeId)
      refresh()
      notify(decision === 'approved'
        ? data.type === 'renewal'
          ? { title: 'Renewal approved', detail: 'The new term\'s placement was created and the recipient has been notified.' }
          : { title: 'Application approved', detail: 'They are now a recipient (announcements reach them) and wait in the Assignments queue for an office. They have been notified.' }
        : data.type === 'renewal'
          ? { title: 'Renewal rejected', detail: 'The recipient is back in the applicant portal and has been notified.' }
          : { title: 'Application rejected', detail: 'The applicant has been notified with your remarks.' })
    },
    onError: showError,
  })

  // Rejecting is final (and sends a recipient back to the applicant portal): ask first.
  const confirmAndReject = async () => {
    if (await confirm(rejectConfirm(selected))) decide.mutate('rejected')
  }

  const confirmNoShow = async () => {
    const ok = await confirm({
      title: 'Mark the interview as a no-show?',
      body: `${selected?.user?.name ?? 'The applicant'} didn't attend. You can reschedule afterwards, or reject with remarks.`,
      confirmLabel: 'Mark no-show',
      tone: 'danger',
    })
    if (ok) markNoShow.mutate()
  }

  // Venue ↔ meeting-link swap when the mode changes.
  const changeMode = (next: 'in_person' | 'online') => {
    setMode(next)
    if (next === 'in_person' && !location) setLocation(DSA_OFFICE)
    if (next === 'online' && location === DSA_OFFICE) setLocation('')
  }

  const openDialog = (kind: 'schedule' | 'reschedule') => {
    setInterviewDate('')
    if (kind === 'reschedule' && selected?.interview) {
      const online = selected.interview.mode === 'online'
      setMode(online ? 'online' : 'in_person')
      setLocation(online ? (selected.interview.meeting_link ?? '') : (selected.interview.location || DSA_OFFICE))
    }
    setDialog(kind)
  }

  const setFilter = (s: ApplicationStatus | null) => {
    setStatusFilter(s)
    setPage(1)
    setSelectedId(null)
  }

  const setType = (t: TypeFilter) => {
    setTypeFilter(t)
    setPage(1)
    setSelectedId(null)
  }

  const status = selected?.status
  const isRenewal = selected?.type === 'renewal'
  const iv = selected?.interview
  const documents = selected?.documents ?? []
  const readiness = selected?.renewal_readiness
  const deciding = status === 'under_review' || status === 'interview_scheduled' || (isRenewal && status === 'submitted')
  // Same gates as the backend: a renewal waits for its checks; a new applicant needs an attended-or-pending interview.
  const canApprove = isRenewal ? readiness?.ready !== false : status === 'interview_scheduled' && iv?.status !== 'no_show'
  const hint = isRenewal
    ? readiness?.ready === false ? (readiness.blocker ?? 'Not ready to approve yet.') : 'Approving renews their placement for the new term. They get an email.'
    : status === 'under_review' ? 'Set an interview before approving.'
    : iv?.status === 'no_show' ? 'They missed the interview. Reschedule it before approving.'
    : 'Approving moves them to Assignments. They get an email either way.'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Applications</h1>
          <p className="mt-1 text-sm text-ink-500">Pick a student on the left, check their details, then approve or reject.</p>
        </div>
        <ApplicationPeriodToggle />
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Application status">
        {STATUS_TABS.map((t, i) => {
          const active = statusFilter === t.status
          const count = countQueries[i]?.data
          return (
            <button key={t.label} role="tab" aria-selected={active} onClick={() => setFilter(t.status)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active ? 'border-[#17815F] bg-[#17815F] text-white shadow-[0_6px_16px_rgba(23,129,95,.22)]' : 'border-ink-900/[.08] bg-white text-ink-600 hover:border-[#17815F]/40 hover:text-[#17815F]'
              }`}>
              <t.Icon className="h-4 w-4" />
              {t.label}
              <span className={`rounded-full px-2 py-px text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}>
                {countQueries[i]?.isLoading ? '·' : count ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* List / detail */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        {/* ── list ───────────────────────────────────────────────────────── */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="space-y-2.5 border-b border-ink-900/[.06] p-3.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedId(null) }}
                placeholder="Search name or student ID"
                className="h-10 w-full rounded-xl border border-ink-200 bg-ink-50/60 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-[#17815F] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-[11px] bg-ink-100 p-1" role="tablist" aria-label="Application type">
              {TYPE_TABS.map((t) => (
                <button key={t.value} role="tab" aria-selected={typeFilter === t.value} onClick={() => setType(t.value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    typeFilter === t.value ? 'bg-white text-[#17815F] shadow-sm' : 'text-ink-500 hover:text-[#17815F]'
                  }`}>
                  {t.label}
                  {t.value === 'renewal' && !!renewalsWaiting && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-px text-[10.5px] font-bold text-violet-700" title="Renewals waiting for a decision">{renewalsWaiting}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[600px] overflow-auto">
            {isLoading ? (
              <div className="space-y-2 p-3.5">
                {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-[54px] animate-pulse rounded-xl bg-ink-200/50" />)}
              </div>
            ) : applications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" />
                <p className="mt-2.5 text-[13.5px] font-semibold text-ink-700">All caught up</p>
                <p className="mt-1 text-[12.5px] text-ink-400">
                  {typeFilter === 'renewal' && !statusFilter && !search ? 'No renewals waiting.' : 'No applications match this view.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-900/[.06]">
                {applications.map((a) => {
                  const [avBg, avFg] = avatar(a.id)
                  const isActive = a.id === activeId
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedId(a.id)}
                        aria-current={isActive}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isActive ? 'bg-[#F1F8F4] shadow-[inset_3px_0_0_#17815F]' : 'hover:bg-ink-50/70'
                        }`}
                      >
                        <UserAvatar name={a.user?.name} avatarUrl={a.user?.avatar_url}
                          className="h-9 w-9 rounded-full text-[12.5px] font-bold" style={{ background: avBg, color: avFg }} />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-950">{a.user?.name ?? '—'}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                            {formatDate(a.created_at)}
                            {a.type === 'renewal' && (
                              <span className="rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-bold text-violet-600">Renewal</span>
                            )}
                          </span>
                        </span>
                        <StatusPill status={a.status} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-ink-900/[.06] px-4 py-2.5">
              <p className="text-xs text-ink-500">Page {meta.current_page} of {meta.last_page}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedId(null) }}
                  disabled={page === 1} aria-label="Previous page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:text-[#17815F] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setPage((p) => p + 1); setSelectedId(null) }}
                  disabled={page >= meta.last_page} aria-label="Next page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:text-[#17815F] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── detail ─────────────────────────────────────────────────────── */}
        <div className={`${CARD} overflow-hidden lg:sticky lg:top-[88px]`}>
          {!activeId ? (
            <div className="px-8 py-[70px] text-center">
              <BadgeCheck className="mx-auto h-11 w-11 text-success-600" />
              <p className="mt-3.5 font-serif text-[22px] font-semibold text-ink-950">All caught up</p>
              <p className="mt-1.5 text-[13.5px] text-ink-500">Nothing is selected. Pick a student on the left to review them.</p>
            </div>
          ) : detailLoading || !selected ? (
            <div className="space-y-4 p-6">
              <div className="h-14 animate-pulse rounded-xl bg-ink-200/60" />
              <div className="h-24 animate-pulse rounded-xl bg-ink-200/60" />
              <div className="h-32 animate-pulse rounded-xl bg-ink-200/60" />
            </div>
          ) : (
            <div>
              {/* header */}
              <div className="flex items-center gap-3.5 border-b border-ink-900/[.06] px-6 py-5">
                {(() => { const [bg, fg] = avatar(selected.id); return (
                  <UserAvatar name={selected.user?.name} avatarUrl={selected.user?.avatar_url}
                    className="h-[52px] w-[52px] rounded-full text-[17px] font-bold" style={{ background: bg, color: fg }} />
                ) })()}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex flex-wrap items-center gap-2 font-serif text-[21px] font-semibold text-ink-950">
                    {selected.user?.name ?? '—'}
                    {isRenewal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-sans text-[11px] font-bold text-violet-700">
                        <RefreshCw className="h-3 w-3" /> Renewal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6F0] px-2 py-0.5 font-sans text-[11px] font-bold text-[#145643]">
                        <UserPlus className="h-3 w-3" /> New applicant
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-400">{selected.user?.email ?? '—'}</p>
                </div>
                <StatusPill status={selected.status} />
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* facts */}
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-900/[.08] bg-ink-900/[.08] sm:grid-cols-4">
                  {[
                    ['Student ID', selected.user?.profile?.student_id_number ?? '—'],
                    ['Application #', `#${selected.id}`],
                    ['Submitted', formatDate(selected.created_at)],
                    ['For term', `${selected.academic_year} · ${selected.semester}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white px-3.5 py-2.5">
                      <p className="text-[11px] text-ink-400">{label}</p>
                      <p className="truncate text-[13px] font-semibold text-ink-900" title={value}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* renewal: last semester at SWAP + the checks */}
                {isRenewal && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3.5">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-violet-700">
                      <Building2 className="h-3.5 w-3.5" /> Last semester at SWAP
                    </p>
                    {selected.renewal_context ? (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12.5px] text-ink-700 sm:grid-cols-2">
                        <span>Office: <b>{selected.renewal_context.office ?? '—'}</b></span>
                        <span>Supervisor: <b>{selected.renewal_context.supervisor ?? '—'}</b>
                          {selected.renewal_context.supervisor_employee_id && (
                            <span className="ml-1 font-mono text-[11px] text-ink-500">EMP {selected.renewal_context.supervisor_employee_id}</span>
                          )}
                        </span>
                        <span>Period: <b>{selected.renewal_context.period}</b></span>
                        <span>Verified hours: <b>{selected.renewal_context.verified_hours}h / {selected.renewal_context.required_hours}h</b></span>
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-violet-700">No previous assignment found for this student.</p>
                    )}
                    {readiness && status === 'submitted' && (
                      <RenewalReadinessPanel readiness={readiness}
                        readyText={`All checks passed. Approving keeps them at the same office for ${selected.academic_year} · ${selected.semester}. No interview needed.`} />
                    )}
                  </div>
                )}

                {/* new applicant: the interview */}
                {!isRenewal && status !== 'approved' && status !== 'rejected' && (
                  <InterviewBanner
                    status={status!}
                    interview={iv ?? null}
                    onMarkReview={() => markReview.mutate()}
                    markingReview={markReview.isPending}
                    onSchedule={() => openDialog('schedule')}
                    onReschedule={() => openDialog('reschedule')}
                    onNoShow={confirmNoShow}
                    markingNoShow={markNoShow.isPending}
                  />
                )}

                {/* documents */}
                {documents.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-400">Documents</p>
                    <div className="flex flex-wrap gap-2">
                      {documents.map((doc) => (
                        <button key={doc.id} onClick={() => setViewDoc(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-900/[.08] bg-white px-3 py-2 text-[12.5px] font-semibold capitalize text-[#17815F] hover:border-[#17815F]/40 hover:bg-[#F1F8F4]">
                          <FileText className="h-3.5 w-3.5" />
                          {doc.document_type.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* decided summary */}
                {(status === 'approved' || status === 'rejected') && (
                  <div
                    className="flex items-center gap-3.5 rounded-[13px] border px-[18px] py-4"
                    style={status === 'approved' ? { background: '#EFF8F4', borderColor: '#B4E1CF' } : { background: '#FEF3F2', borderColor: '#FBCBC6' }}
                  >
                    {status === 'approved'
                      ? <BadgeCheck className="h-6 w-6 flex-shrink-0 text-success-800" />
                      : <Ban className="h-6 w-6 flex-shrink-0 text-danger-700" />}
                    <div className="min-w-0 flex-1 leading-snug">
                      <p className="text-sm font-bold" style={{ color: status === 'approved' ? '#145643' : '#B42318' }}>
                        {status === 'approved' ? (isRenewal ? 'Renewal approved' : 'Approved, waiting for an office') : 'Application rejected'}
                      </p>
                      <p className="text-[12.5px]" style={{ color: status === 'approved' ? '#145643' : '#B42318', opacity: 0.85 }}>
                        {status === 'approved'
                          ? isRenewal ? 'Their placement continues in the new term.' : 'This student is now in the Assignments queue.'
                          : selected.remarks || 'This applicant was not accepted this cycle.'}
                      </p>
                    </div>
                    {status === 'approved' && !isRenewal && (
                      <Link href="/admin/assignments" className="inline-flex flex-none items-center gap-1 text-[12.5px] font-semibold text-[#17815F] hover:underline">
                        Go to Assignments <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* decision footer */}
              {deciding && (
                <div className="border-t border-ink-900/[.06] bg-ink-50/50 px-6 py-4">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks (needed if you reject)"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-[#17815F] focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-500">{hint}</p>
                    <button
                      onClick={confirmAndReject}
                      disabled={decide.isPending || !remarks.trim()}
                      title={!remarks.trim() ? 'Write remarks to reject' : undefined}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-danger-200 bg-white px-4 text-sm font-semibold text-[#C8322B] hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => decide.mutate('approved')}
                      disabled={decide.isPending || !canApprove}
                      title={!canApprove ? hint : undefined}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,129,95,.25)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                      style={{ background: GREEN }}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dialog && selected && (
        <InterviewDialog
          kind={dialog}
          name={selected.user?.name ?? 'the applicant'}
          date={interviewDate} setDate={setInterviewDate}
          mode={mode} setMode={changeMode}
          location={location} setLocation={setLocation}
          pending={dialog === 'schedule' ? scheduleInterview.isPending : reschedule.isPending}
          onClose={() => setDialog(null)}
          onSubmit={() => (dialog === 'schedule' ? scheduleInterview.mutate() : reschedule.mutate())}
        />
      )}
      {viewDoc && <DocumentViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  )
}


/** A new applicant's interview: not reviewed yet → under review → interview set (or missed). */
function InterviewBanner({ status, interview: iv, onMarkReview, markingReview, onSchedule, onReschedule, onNoShow, markingNoShow }: {
  status: string
  interview: Interview | null
  onMarkReview: () => void
  markingReview: boolean
  onSchedule: () => void
  onReschedule: () => void
  onNoShow: () => void
  markingNoShow: boolean
}) {
  const btn = 'inline-flex h-9 flex-none items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold'

  if (status === 'submitted') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#BFD3E6] bg-[#EEF4FA] px-4 py-3">
        <Inbox className="h-5 w-5 flex-none text-[#2F5D8A]" />
        <p className="min-w-0 flex-1 text-[13px] text-[#2F5D8A]">
          <b>Not reviewed yet.</b> Start the review to set an interview.
        </p>
        <button onClick={onMarkReview} disabled={markingReview} className={`${btn} bg-[#17815F] text-white disabled:opacity-50`}>
          <Clock className="h-4 w-4" /> {markingReview ? 'Moving…' : 'Mark under review'}
        </button>
      </div>
    )
  }

  if (status === 'under_review' || !iv) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3">
        <CalendarClock className="h-5 w-5 flex-none text-warning-700" />
        <p className="min-w-0 flex-1 text-[13px] text-warning-700"><b>No interview scheduled yet.</b> Set one before approving.</p>
        <button onClick={onSchedule} className={`${btn} bg-[#17815F] text-white`}>
          <CalendarCheck className="h-4 w-4" /> Set interview
        </button>
      </div>
    )
  }

  const missed = iv.status === 'no_show'
  return (
    <div className={`rounded-xl border px-4 py-3 ${missed ? 'border-gold-200 bg-gold-50' : 'border-violet-200 bg-violet-50/60'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <CalendarCheck className={`h-5 w-5 flex-none ${missed ? 'text-warning-700' : 'text-violet-600'}`} />
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <p className={missed ? 'text-warning-700' : 'text-violet-800'}>
            <b>{missed ? 'Missed the interview' : 'Interview set'} for {formatDateTime(iv.scheduled_at)}</b>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-600">
            <span className="inline-flex items-center gap-1">
              {iv.mode === 'online' ? <Video className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {iv.mode === 'online' ? 'Online' : 'In person'}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 flex-none" /><span className="truncate">{iv.location || 'Online meeting link'}</span></span>
          </p>
        </div>
        {!missed && (
          <button onClick={onNoShow} disabled={markingNoShow} className={`${btn} border border-gold-200 bg-white text-warning-700 disabled:opacity-50`}>
            <Ban className="h-4 w-4" /> No-show
          </button>
        )}
        <button onClick={onReschedule} className={`${btn} border border-violet-200 bg-white text-violet-700`}>
          <CalendarClock className="h-4 w-4" /> Reschedule
        </button>
      </div>
      {(iv.history?.length ?? 0) > 0 && (
        <div className="mt-2.5 border-t border-violet-200/70 pt-2">
          <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-violet-400">Reschedule history</p>
          {iv.history!.map((h, i) => (
            <p key={i} className="text-[11.5px] text-ink-600">
              {h.from ? formatDateTime(h.from) : '?'} → {h.to ? formatDateTime(h.to) : '?'}{h.changed_by ? ` (by ${h.changed_by})` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** Set or move an interview: date & time, in person (venue) or online (meeting link). */
function InterviewDialog({ kind, name, date, setDate, mode, setMode, location, setLocation, pending, onClose, onSubmit }: {
  kind: 'schedule' | 'reschedule'
  name: string
  date: string; setDate: (v: string) => void
  mode: 'in_person' | 'online'; setMode: (v: 'in_person' | 'online') => void
  location: string; setLocation: (v: string) => void
  pending: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const field = 'h-11 w-full rounded-xl border border-ink-200 bg-ink-50/60 px-3 text-sm text-ink-900 focus:border-[#17815F] focus:bg-white focus:outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={kind === 'schedule' ? 'Set interview' : 'Reschedule interview'}
        className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink-950">{kind === 'schedule' ? 'Set interview' : 'Reschedule interview'}</h2>
            <p className="text-[13px] text-ink-500">{name} gets an email with the details.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Date &amp; time</span>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'in_person' | 'online')} className={field}>
                <option value="in_person">In person</option>
                <option value="online">Online</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-600">{mode === 'in_person' ? 'Venue' : 'Meeting link'}</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder={mode === 'in_person' ? 'Building / office' : 'https://meet.google.com/…'} className={field} />
          </label>
          <p className="text-[12px] text-ink-500">
            {mode === 'in_person' ? 'In-person interviews are held at the DSA office. Leave as-is unless it changes.' : 'Share an online meeting link the applicant can join.'}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="h-10 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-600 hover:bg-ink-50">Cancel</button>
          <button onClick={onSubmit} disabled={pending || !date || !location.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-45"
            style={{ background: GREEN }}>
            <CalendarCheck className="h-4 w-4" />
            {pending ? 'Saving…' : kind === 'schedule' ? 'Set interview' : 'Confirm new time'}
          </button>
        </div>
      </div>
    </div>
  )
}
