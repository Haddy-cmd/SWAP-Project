'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search, ArrowRight, CheckCircle2, Inbox, Clock, CalendarClock, XCircle,
  CheckCircle, Calendar, CalendarCheck, Eye, ChevronLeft, ChevronRight,
  Video, Users, MapPin, AlertTriangle, Ban, BadgeCheck, RefreshCw,
} from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationPeriodToggle } from '@/components/admin/ApplicationPeriodToggle'
import { RenewalPeriodToggle } from '@/components/admin/RenewalPeriodToggle'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatDate, formatDateTime } from '@/lib/utils/formatDate'
import type { ApplicationStatus } from '@/types/application.types'

const DSA_OFFICE = 'Office of the Dean of Students Affairs (DSA)'

// ── small presentational helpers ────────────────────────────────────────────
const AVATARS: [string, string][] = [
  ['#E3EEE5', '#1F5B3A'], ['#F3F7FB', '#4A82B8'], ['#EFF8F4', '#1F8163'],
  ['#FDF8E4', '#9A7412'], ['#EFE9F7', '#6B4E9A'], ['#FEF3F2', '#E2483B'], ['#F3F7FB', '#234A70'],
]
const avatar = (id: number) => AVATARS[id % AVATARS.length]

const STATUS_META: Record<string, { short: string; color: string; dot: string }> = {
  submitted: { short: 'Submitted', color: '#2F5D8A', dot: '#4A82B8' },
  under_review: { short: 'Review', color: '#B45309', dot: '#F59E0B' },
  interview_scheduled: { short: 'Interview', color: '#5A3E86', dot: '#6B4E9A' },
  approved: { short: 'Approved', color: '#145643', dot: '#1F8163' },
  rejected: { short: 'Rejected', color: '#B42318', dot: '#E2483B' },
}

const STAT_CARDS: {
  status: ApplicationStatus
  label: string
  iconBg: string
  iconFg: string
  Icon: ComponentType<{ className?: string }>
}[] = [
  { status: 'submitted', label: 'Submitted', iconBg: '#F3F7FB', iconFg: '#4A82B8', Icon: Inbox },
  { status: 'under_review', label: 'Under review', iconBg: '#FFFBEB', iconFg: '#9A7412', Icon: Clock },
  { status: 'interview_scheduled', label: 'Interview set', iconBg: '#EFE9F7', iconFg: '#6B4E9A', Icon: CalendarClock },
  { status: 'rejected', label: 'Rejected', iconBg: '#FEF3F2', iconFg: '#E2483B', Icon: XCircle },
]

type Toast = { text: string; bg: string; border: string; color: string; Icon: ComponentType<{ className?: string }> }

export default function AdminApplicationsPage() {
  const queryClient = useQueryClient()

  // queue / filter state
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // review-panel form state
  const [interviewDate, setInterviewDate] = useState('')
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person')
  const [location, setLocation] = useState(DSA_OFFICE)
  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)

  // ── queue list (same params/behaviour as before) ─────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['admin-applications', statusFilter ?? 'active', search, page],
    queryFn: () =>
      applicationsApi.adminListApplications({
        page: String(page),
        ...(search && { search }),
        // Approved applicants graduate to the Assignments queue, so the default
        // view hides them. Each stat card narrows to one explicit status.
        ...(statusFilter ? { status: statusFilter } : { exclude_status: 'approved' }),
      }),
  })
  const applications = listData?.data ?? []
  const meta = listData?.meta

  // ── per-status counts for the stat cards ─────────────────────────────────
  const countQueries = useQueries({
    queries: STAT_CARDS.map((c) => ({
      queryKey: ['admin-applications', 'count', c.status],
      queryFn: () =>
        applicationsApi.adminListApplications({ status: c.status, page: '1' }).then((r) => r.meta?.total ?? 0),
    })),
  })

  // The active selection defaults to the first item in the current queue.
  const activeId = selectedId ?? applications[0]?.id ?? null

  // ── selected application detail ──────────────────────────────────────────
  const { data: selected, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-application', activeId],
    queryFn: () => applicationsApi.adminGetApplication(activeId!),
    enabled: activeId != null,
  })

  // Reset the form whenever the selected applicant changes so values never leak
  // from one applicant to another.
  useEffect(() => {
    setInterviewDate('')
    setMode('in_person')
    setLocation(DSA_OFFICE)
    setRemarks('')
    setToast(null)
    setRescheduling(false)
  }, [activeId])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
    queryClient.invalidateQueries({ queryKey: ['admin-application', activeId] })
  }

  // ── mutations (identical endpoints/payloads to the old detail page) ───────
  const markReview = useMutation({
    mutationFn: () => applicationsApi.adminMarkUnderReview(activeId!),
    onSuccess: () => {
      refresh()
      setToast({ text: 'Moved to Under Review. You can now schedule an interview.', bg: '#FDF8E4', border: '#F7E39A', color: '#7A5C0C', Icon: Clock })
    },
  })

  const scheduleInterview = useMutation({
    mutationFn: () =>
      applicationsApi.adminScheduleInterview(activeId!, { scheduled_at: interviewDate, location, mode }),
    onSuccess: () => {
      refresh()
      setInterviewDate('')
      setToast({ text: 'Interview scheduled. The applicant has been notified.', bg: '#F6F2FB', border: '#E0D5EF', color: '#5A3E86', Icon: CalendarCheck })
    },
  })

  const reschedule = useMutation({
    mutationFn: () =>
      applicationsApi.adminRescheduleInterview(activeId!, { scheduled_at: interviewDate, location, mode }),
    onSuccess: () => {
      refresh()
      setInterviewDate('')
      setRescheduling(false)
      setToast({ text: 'Interview rescheduled. The applicant has been notified.', bg: '#F6F2FB', border: '#E0D5EF', color: '#5A3E86', Icon: CalendarCheck })
    },
  })

  const markNoShow = useMutation({
    mutationFn: () => applicationsApi.adminMarkInterviewNoShow(activeId!),
    onSuccess: () => {
      refresh()
      setToast({ text: 'Marked as no-show. You can reschedule or reject with remarks.', bg: '#FDF8E4', border: '#F7E39A', color: '#7A5C0C', Icon: AlertTriangle })
    },
  })

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      applicationsApi.adminDecideApplication(activeId!, { decision, remarks }),
    onSuccess: (_data, decision) => {
      // Keep the decided applicant in view so the admin sees the confirmation,
      // even though it leaves the active queue.
      setSelectedId(activeId)
      refresh()
      setToast(
        decision === 'approved'
          ? { text: 'Approved — moved to the Assignments queue.', bg: '#EFF8F4', border: '#B4E1CF', color: '#145643', Icon: CheckCircle }
          : { text: 'Application rejected. The applicant has been notified.', bg: '#FEF3F2', border: '#FBCBC6', color: '#B42318', Icon: XCircle },
      )
    },
  })

  const setFilter = (s: ApplicationStatus) => {
    setStatusFilter((cur) => (cur === s ? null : s))
    setPage(1)
    setSelectedId(null)
  }

  const status = selected?.status
  const isRenewal = selected?.type === 'renewal'
  const iv = selected?.interview
  const documents = selected?.documents ?? []

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Admissions Review</p>
        <h1 className="mt-1 font-serif text-3xl font-medium text-ink-950">Applications</h1>
      </div>

      {/* application-period toggle (unchanged behaviour) */}
      <ApplicationPeriodToggle />
      <RenewalPeriodToggle />

      {/* approved applicants move to the assignment queue */}
      <Link
        href="/admin/assignments"
        className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm transition-colors hover:bg-success-100"
      >
        <span className="flex items-center gap-2 font-medium text-success-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Approved applicants move to the Assignments queue, ready to be onboarded to an office.
        </span>
        <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-success-800">
          Go to Assignments
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      {/* stat cards = status filters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((c, i) => {
          const active = statusFilter === c.status
          return (
            <button
              key={c.status}
              onClick={() => setFilter(c.status)}
              className="flex items-center gap-3 rounded-[13px] border bg-white px-4 py-3.5 text-left transition-colors"
              style={{ borderColor: active ? '#1F5B3A' : '#DCE0CF', boxShadow: active ? '0 6px 16px rgba(22,69,43,.14)' : '0 1px 3px rgba(19,36,26,.04)' }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: c.iconBg, color: c.iconFg }}>
                <c.Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-serif text-2xl font-semibold leading-none text-ink-950">
                  {countQueries[i]?.isLoading ? '·' : countQueries[i]?.data ?? 0}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-ink-400">{c.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* master / detail */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* ── queue ─────────────────────────────────────────────────────── */}
        <div>
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedId(null) }}
              placeholder="Search applicants…"
              className="h-11 w-full rounded-[11px] border border-ink-200 bg-white pl-10 pr-4 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-warning-700">
            {statusFilter ? STATUS_META[statusFilter]?.short ?? 'Filtered' : 'All pending'}
            <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] text-gold-700">{meta?.total ?? applications.length}</span>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(null); setSelectedId(null) }} className="ml-auto text-xs font-semibold text-brand-700">
                Clear
              </button>
            )}
          </div>

          <div className="flex max-h-[560px] flex-col gap-2.5 overflow-auto pr-0.5">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((n) => <div key={n} className="h-[62px] animate-pulse rounded-xl bg-ink-200/60" />)
            ) : applications.length === 0 ? (
              <div className="rounded-[13px] border border-dashed border-ink-300 bg-white px-5 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" />
                <p className="mt-2.5 text-[13.5px] font-semibold text-ink-700">All caught up</p>
                <p className="mt-1 text-[12.5px] text-ink-400">No applications match this view.</p>
              </div>
            ) : (
              applications.map((a) => {
                const [avBg, avFg] = avatar(a.id)
                const m = STATUS_META[a.status] ?? STATUS_META.submitted
                const isActive = a.id === activeId
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className="flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left transition-colors"
                    style={{ borderColor: isActive ? '#1F5B3A' : '#DCE0CF', boxShadow: isActive ? '0 6px 18px rgba(22,69,43,.14)' : '0 1px 3px rgba(19,36,26,.04)' }}
                  >
                    <UserAvatar name={a.user?.name} avatarUrl={a.user?.avatar_url}
                      className="h-[38px] w-[38px] rounded-full text-[13px] font-bold" style={{ background: avBg, color: avFg }} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13.5px] font-semibold text-ink-950">{a.user?.name ?? '—'}</span>
                      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
                        {formatDate(a.created_at)}
                        {a.type === 'renewal' && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-bold text-violet-600">Renewal</span>
                        )}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-[10.5px] font-bold" style={{ color: m.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: m.dot }} />
                      {m.short}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* pagination preserved */}
          {meta && meta.last_page > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-ink-500">Page {meta.current_page} of {meta.last_page} · {meta.total} total</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedId(null) }}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => { setPage((p) => p + 1); setSelectedId(null) }}
                  disabled={page === meta.last_page}
                  className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── review panel ──────────────────────────────────────────────── */}
        <div className="sticky top-[88px] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_8px_24px_rgba(19,36,26,.08)]">
          {!activeId ? (
            <div className="px-8 py-[70px] text-center">
              <BadgeCheck className="mx-auto h-11 w-11 text-success-600" />
              <p className="mt-3.5 font-serif text-[22px] font-semibold text-ink-950">All caught up</p>
              <p className="mt-1.5 text-[13.5px] text-ink-500">No application is selected. Pick one from the queue to review it.</p>
            </div>
          ) : detailLoading || !selected ? (
            <div className="space-y-4 p-6">
              <div className="h-14 animate-pulse rounded-xl bg-ink-200/60" />
              <div className="h-24 animate-pulse rounded-xl bg-ink-200/60" />
              <div className="h-32 animate-pulse rounded-xl bg-ink-200/60" />
            </div>
          ) : (
            <div>
              {/* selected header */}
              <div className="border-b border-ink-200 px-6 py-6">
                <div className="flex items-center gap-3.5">
                  {(() => { const [bg, fg] = avatar(selected.id); return (
                    <UserAvatar name={selected.user?.name} avatarUrl={selected.user?.avatar_url}
                      className="h-14 w-14 rounded-full text-[18px] font-bold" style={{ background: bg, color: fg }} />
                  ) })()}
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="flex flex-wrap items-center gap-2 font-serif text-[22px] font-semibold text-ink-950">
                      {selected.user?.name ?? '—'}
                      {isRenewal && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-sans text-[11px] font-bold text-violet-600">Renewal</span>
                      )}
                    </p>
                    <p className="text-[13px] text-ink-400">{selected.user?.email ?? '—'}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div className="px-6 py-5">
                {/* meta */}
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200">
                  {[
                    ['Period', `${selected.academic_year} · ${selected.semester}`],
                    ['Submitted', formatDate(selected.created_at)],
                    ['Email', selected.user?.email ?? '—'],
                    ['Application', `#${selected.id}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white px-4 py-3">
                      <p className="text-[11px] text-ink-400">{label}</p>
                      <p className="truncate text-[13px] font-semibold text-ink-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* renewal: previous service record */}
                {isRenewal && (
                  <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-violet-700">
                      <RefreshCw className="h-3.5 w-3.5" /> Previous service record
                    </p>
                    {selected.renewal_context ? (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-ink-700 sm:grid-cols-2">
                        <span>Office: <b>{selected.renewal_context.office ?? '—'}</b></span>
                        <span>Supervisor: <b>{selected.renewal_context.supervisor ?? '—'}</b></span>
                        <span>Period: <b>{selected.renewal_context.period}</b></span>
                        <span>Verified hours: <b>{selected.renewal_context.verified_hours}h / {selected.renewal_context.required_hours}h</b></span>
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-violet-700">No previous assignment found for this student.</p>
                    )}
                    <p className="mt-2 text-[11.5px] text-ink-500">
                      Approving rolls their assignment into {selected.academic_year} — {selected.semester} at the same office. No interview needed.
                    </p>
                  </div>
                )}

                {/* documents (review stages) */}
                {documents.length > 0 && status !== 'approved' && status !== 'rejected' && (
                  <div className="mb-5">
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-ink-400">Documents</p>
                    <div className="flex flex-col gap-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2.5 rounded-[10px] border border-ink-200 px-3.5 py-2.5">
                          <CheckCircle className="h-4 w-4 text-success-600" />
                          <span className="flex-1 text-[13px] capitalize text-ink-700">{doc.document_type.replace(/_/g, ' ')}</span>
                          <button onClick={() => setViewDoc(doc)} className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STATE: submitted → mark under review (fresh applications only) */}
                {status === 'submitted' && !isRenewal && (
                  <div>
                    <div className="mb-4 flex gap-3 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3.5">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-gold-600" />
                      <p className="text-[12.5px] leading-relaxed text-gold-700">
                        Move this application to <strong>Under Review</strong> to start processing it and unlock interview scheduling.
                      </p>
                    </div>
                    <button
                      onClick={() => markReview.mutate()}
                      disabled={markReview.isPending}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 text-sm font-semibold text-ink-25 shadow-[0_10px_22px_rgba(22,69,43,.24)] disabled:opacity-50"
                    >
                      <Clock className="h-[18px] w-[18px]" /> Mark as Under Review
                    </button>
                  </div>
                )}

                {/* STATE: under_review → schedule interview (fresh applications only) */}
                {status === 'under_review' && !isRenewal && (
                  <div className="mb-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-brand-700" />
                      <span className="text-[15px] font-bold text-ink-950">Schedule Interview</span>
                    </div>
                    <div className="mb-3.5 grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={interviewDate}
                          onChange={(e) => setInterviewDate(e.target.value)}
                          className="h-[46px] w-full rounded-[11px] border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">Mode</label>
                        <select
                          value={mode}
                          onChange={(e) => {
                            const next = e.target.value as 'in_person' | 'online'
                            setMode(next)
                            if (next === 'in_person' && !location) setLocation(DSA_OFFICE)
                            if (next === 'online' && location === DSA_OFFICE) setLocation('')
                          }}
                          className="h-[46px] w-full rounded-[11px] border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                        >
                          <option value="in_person">In Person</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">{mode === 'in_person' ? 'Venue' : 'Meeting Link'}</label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={mode === 'in_person' ? 'Building / office' : 'https://meet.google.com/…'}
                        className="h-[46px] w-full rounded-[11px] border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                      />
                    </div>
                    <p className="mb-4 text-xs leading-relaxed text-ink-500">
                      {mode === 'in_person'
                        ? 'In-person interviews are held at the DSA office. Leave as-is unless it changes.'
                        : 'Share an online meeting link the applicant can join.'}
                    </p>
                    <button
                      onClick={() => scheduleInterview.mutate()}
                      disabled={scheduleInterview.isPending || !interviewDate}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[0_10px_22px_rgba(22,69,43,.2)] disabled:cursor-not-allowed"
                      style={{ background: interviewDate ? 'linear-gradient(180deg,#2A7148,#16452B)' : '#CAD2BC' }}
                    >
                      <CalendarCheck className="h-[18px] w-[18px]" /> Schedule Interview
                    </button>
                  </div>
                )}

                {/* STATE: interview_scheduled → details */}
                {status === 'interview_scheduled' && iv && (
                  <div className="mb-5 rounded-[13px] border border-violet-200 bg-violet-50 px-[18px] py-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <CalendarCheck className="h-[19px] w-[19px] text-violet-600" />
                      <span className="text-[13.5px] font-bold text-violet-700">Interview Scheduled</span>
                      {iv.status === 'no_show' && (
                        <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-gold-200">No-show</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 text-[13px] text-ink-700">
                      <span className="flex items-center gap-2.5"><Clock className="h-[17px] w-[17px] text-violet-400" />{formatDateTime(iv.scheduled_at)}</span>
                      <span className="flex items-center gap-2.5">
                        {iv.mode === 'online' ? <Video className="h-[17px] w-[17px] text-violet-400" /> : <Users className="h-[17px] w-[17px] text-violet-400" />}
                        {iv.mode === 'online' ? 'Online' : 'In Person'}
                      </span>
                      <span className="flex items-center gap-2.5"><MapPin className="h-[17px] w-[17px] text-violet-400" />{iv.location || 'Online meeting link'}</span>
                    </div>

                    {iv.status === 'no_show' && (
                      <p className="mt-2.5 text-[12px] text-gold-700">
                        The applicant did not attend. Reschedule below, or reject with remarks.
                      </p>
                    )}

                    {(iv.history?.length ?? 0) > 0 && (
                      <div className="mt-3 border-t border-violet-200 pt-2.5">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-violet-400">Reschedule history</p>
                        {iv.history!.map((h, i) => (
                          <p key={i} className="text-[11.5px] text-ink-600">
                            {h.from ? formatDateTime(h.from) : '?'} {'->'} {h.to ? formatDateTime(h.to) : '?'}
                            {h.changed_by ? ` (by ${h.changed_by})` : ''}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {iv.status !== 'no_show' && (
                        <button
                          onClick={() => markNoShow.mutate()}
                          disabled={markNoShow.isPending}
                          className="flex h-9 items-center gap-1.5 rounded-lg border border-gold-200 bg-gold-50 px-3 text-[12.5px] font-semibold text-gold-700 disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4" /> Mark as No-show
                        </button>
                      )}
                      <button
                        onClick={() => setRescheduling((r) => !r)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 text-[12.5px] font-semibold text-violet-700"
                      >
                        <CalendarClock className="h-4 w-4" /> {rescheduling ? 'Cancel reschedule' : 'Reschedule'}
                      </button>
                    </div>

                    {rescheduling && (
                      <div className="mt-3 space-y-2.5 rounded-xl border border-violet-200 bg-white p-3">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <input
                            type="datetime-local"
                            value={interviewDate}
                            onChange={(e) => setInterviewDate(e.target.value)}
                            className="h-10 rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                          />
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as 'in_person' | 'online')}
                            className="h-10 rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                          >
                            <option value="in_person">In person</option>
                            <option value="online">Online</option>
                          </select>
                        </div>
                        <input
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder={mode === 'online' ? 'Meeting link' : 'Venue'}
                          className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                        />
                        <button
                          onClick={() => reschedule.mutate()}
                          disabled={reschedule.isPending || !interviewDate}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-600 to-brand-800 text-[13px] font-semibold text-white disabled:opacity-50"
                        >
                          <CalendarCheck className="h-4 w-4" /> {reschedule.isPending ? 'Rescheduling...' : 'Confirm new schedule'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* DECISION — Approve unlocks only after an interview is scheduled; Reject is allowed earlier */}
                {(status === 'under_review' || status === 'interview_scheduled' || (isRenewal && status === 'submitted')) && (
                  <div>
                    {status === 'under_review' && !isRenewal && (
                      <div className="mb-3 flex gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-[12px] leading-relaxed text-gold-700">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gold-600" />
                        Schedule an interview before approving .
                      </div>
                    )}
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Remarks (required for rejection)"
                      rows={3}
                      className="mb-3 w-full resize-none rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
                    />
                    <div className="flex gap-2.5">
                      {(status === 'interview_scheduled' || isRenewal) && (
                        <button
                          onClick={() => decide.mutate('approved')}
                          disabled={decide.isPending}
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-success-600 to-success-700 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(25,107,83,.24)] disabled:opacity-50"
                        >
                          <CheckCircle className="h-[18px] w-[18px]" /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => decide.mutate('rejected')}
                        disabled={decide.isPending || !remarks.trim()}
                        className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-danger-200 bg-danger-50 text-sm font-semibold text-danger-700 disabled:opacity-50 ${status === 'interview_scheduled' || isRenewal ? 'px-5' : 'flex-1'}`}
                      >
                        <XCircle className="h-[18px] w-[18px]" /> Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* DECIDED summary */}
                {(status === 'approved' || status === 'rejected') && (
                  <div
                    className="flex items-center gap-3.5 rounded-[13px] border px-[18px] py-4"
                    style={status === 'approved'
                      ? { background: '#EFF8F4', borderColor: '#B4E1CF' }
                      : { background: '#FEF3F2', borderColor: '#FBCBC6' }}
                  >
                    {status === 'approved'
                      ? <BadgeCheck className="h-6 w-6 flex-shrink-0 text-success-800" />
                      : <Ban className="h-6 w-6 flex-shrink-0 text-danger-700" />}
                    <div className="leading-snug">
                      <p className="text-sm font-bold" style={{ color: status === 'approved' ? '#145643' : '#B42318' }}>
                        {status === 'approved' ? 'Approved — moved to Assignments' : 'Application Rejected'}
                      </p>
                      <p className="text-[12.5px]" style={{ color: status === 'approved' ? '#145643' : '#B42318', opacity: 0.85 }}>
                        {status === 'approved'
                          ? 'This student is now in the Assignments queue.'
                          : selected.remarks || 'This applicant was not accepted this cycle.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* toast */}
                {toast && (
                  <div className="mt-3.5 flex items-center gap-2.5 rounded-[11px] border px-3.5 py-3 text-[12.5px] font-semibold" style={{ background: toast.bg, borderColor: toast.border, color: toast.color }}>
                    <toast.Icon className="h-[18px] w-[18px]" /> {toast.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {viewDoc && <DocumentViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  )
}
