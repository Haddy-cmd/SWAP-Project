'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search, ArrowRight, CheckCircle2, Inbox, Clock, CalendarClock, XCircle,
  CheckCircle, Calendar, CalendarCheck, Eye, ChevronLeft, ChevronRight,
  Video, Users, MapPin, AlertTriangle, Ban, BadgeCheck,
} from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationPeriodToggle } from '@/components/admin/ApplicationPeriodToggle'
import { formatDate, formatDateTime } from '@/lib/utils/formatDate'
import type { ApplicationStatus } from '@/types/application.types'

const DSA_OFFICE = 'Office of the Dean of Students Affairs (DSA)'

// ── small presentational helpers ────────────────────────────────────────────
const AVATARS: [string, string][] = [
  ['#FBEAEC', '#7C1B26'], ['#EAF1F7', '#3B7FB5'], ['#EAF5EC', '#4E9657'],
  ['#FBF3E2', '#B8860B'], ['#F1ECF7', '#6B4E9A'], ['#F7EDE8', '#C0562F'], ['#EAF1F7', '#1F4E6B'],
]
const avatar = (id: number) => AVATARS[id % AVATARS.length]
const initials = (name?: string | null) =>
  (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

const STATUS_META: Record<string, { short: string; color: string; dot: string }> = {
  submitted: { short: 'Submitted', color: '#1F5C86', dot: '#3B7FB5' },
  under_review: { short: 'Review', color: '#9A6B12', dot: '#D8A12B' },
  interview_scheduled: { short: 'Interview', color: '#5A3E86', dot: '#6B4E9A' },
  approved: { short: 'Approved', color: '#2C5A33', dot: '#4E9657' },
  rejected: { short: 'Rejected', color: '#A52834', dot: '#C0562F' },
}

const STAT_CARDS: {
  status: ApplicationStatus
  label: string
  iconBg: string
  iconFg: string
  Icon: ComponentType<{ className?: string }>
}[] = [
  { status: 'submitted', label: 'Submitted', iconBg: '#EAF1F7', iconFg: '#3B7FB5', Icon: Inbox },
  { status: 'under_review', label: 'Under review', iconBg: '#FDF3E2', iconFg: '#B8860B', Icon: Clock },
  { status: 'interview_scheduled', label: 'Interview set', iconBg: '#F1ECF7', iconFg: '#6B4E9A', Icon: CalendarClock },
  { status: 'rejected', label: 'Rejected', iconBg: '#FCF2F3', iconFg: '#C0562F', Icon: XCircle },
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
      setToast({ text: 'Moved to Under Review. You can now schedule an interview.', bg: '#FFF9EC', border: '#F0DFAE', color: '#7A5C12', Icon: Clock })
    },
  })

  const scheduleInterview = useMutation({
    mutationFn: () =>
      applicationsApi.adminScheduleInterview(activeId!, { scheduled_at: interviewDate, location, mode }),
    onSuccess: () => {
      refresh()
      setInterviewDate('')
      setToast({ text: 'Interview scheduled. The applicant has been notified.', bg: '#F4EEFA', border: '#E2D5F0', color: '#5A3E86', Icon: CalendarCheck })
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
          ? { text: 'Approved — moved to the Assignments queue.', bg: '#EEF7EF', border: '#D6EBD8', color: '#2C5A33', Icon: CheckCircle }
          : { text: 'Application rejected. The applicant has been notified.', bg: '#FCF2F3', border: '#F0D4D7', color: '#A52834', Icon: XCircle },
      )
    },
  })

  const setFilter = (s: ApplicationStatus) => {
    setStatusFilter((cur) => (cur === s ? null : s))
    setPage(1)
    setSelectedId(null)
  }

  const status = selected?.status
  const iv = selected?.interview
  const documents = selected?.documents ?? []

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Admissions Review</p>
        <h1 className="mt-1 font-serif text-3xl font-medium text-[#241715]">Applications</h1>
      </div>

      {/* application-period toggle (unchanged behaviour) */}
      <ApplicationPeriodToggle />

      {/* approved applicants move to the assignment queue */}
      <Link
        href="/admin/assignments"
        className="flex items-center justify-between gap-3 rounded-xl border border-[#D6EBD8] bg-[#EEF7EF] px-4 py-3 text-sm transition-colors hover:bg-[#E2F1E4]"
      >
        <span className="flex items-center gap-2 font-medium text-[#2C5A33]">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Approved applicants move to the Assignments queue, ready to be onboarded to an office.
        </span>
        <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-[#2C5A33]">
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
              style={{ borderColor: active ? '#7C1B26' : '#EFE5DA', boxShadow: active ? '0 6px 16px rgba(108,22,32,.14)' : '0 1px 3px rgba(60,30,25,.04)' }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: c.iconBg, color: c.iconFg }}>
                <c.Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-serif text-2xl font-semibold leading-none text-[#241715]">
                  {countQueries[i]?.isLoading ? '·' : countQueries[i]?.data ?? 0}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[#A38A82]">{c.label}</span>
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
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B79B7E]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedId(null) }}
              placeholder="Search applicants…"
              className="h-11 w-full rounded-[11px] border border-[#EADFD4] bg-white pl-10 pr-4 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
            />
          </div>

          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A6B12]">
            {statusFilter ? STATUS_META[statusFilter]?.short ?? 'Filtered' : 'All pending'}
            <span className="rounded-full bg-[#F4E4BC] px-2.5 py-0.5 text-[11px] text-[#8A5E10]">{meta?.total ?? applications.length}</span>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(null); setSelectedId(null) }} className="ml-auto text-xs font-semibold text-[#7C1B26]">
                Clear
              </button>
            )}
          </div>

          <div className="flex max-h-[560px] flex-col gap-2.5 overflow-auto pr-0.5">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((n) => <div key={n} className="h-[62px] animate-pulse rounded-xl bg-[#EFE5DA]/60" />)
            ) : applications.length === 0 ? (
              <div className="rounded-[13px] border border-dashed border-[#E0D2C4] bg-white px-5 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[#4E9657]" />
                <p className="mt-2.5 text-[13.5px] font-semibold text-[#3F2F2A]">All caught up</p>
                <p className="mt-1 text-[12.5px] text-[#A38A82]">No applications match this view.</p>
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
                    style={{ borderColor: isActive ? '#7C1B26' : '#EFE5DA', boxShadow: isActive ? '0 6px 18px rgba(108,22,32,.14)' : '0 1px 3px rgba(60,30,25,.04)' }}
                  >
                    <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: avBg, color: avFg }}>
                      {initials(a.user?.name)}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13.5px] font-semibold text-[#241715]">{a.user?.name ?? '—'}</span>
                      <span className="block text-[11.5px] text-[#A38A82]">{formatDate(a.created_at)}</span>
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
              <p className="text-xs text-[#8A7A73]">Page {meta.current_page} of {meta.last_page} · {meta.total} total</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedId(null) }}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-lg border border-[#EADFD4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#7C1B26] disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => { setPage((p) => p + 1); setSelectedId(null) }}
                  disabled={page === meta.last_page}
                  className="flex items-center gap-1 rounded-lg border border-[#EADFD4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#7C1B26] disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── review panel ──────────────────────────────────────────────── */}
        <div className="sticky top-[88px] overflow-hidden rounded-2xl border border-[#EFE5DA] bg-white shadow-[0_8px_24px_rgba(60,30,25,.08)]">
          {!activeId ? (
            <div className="px-8 py-[70px] text-center">
              <BadgeCheck className="mx-auto h-11 w-11 text-[#4E9657]" />
              <p className="mt-3.5 font-serif text-[22px] font-semibold text-[#241715]">All caught up</p>
              <p className="mt-1.5 text-[13.5px] text-[#8A7A73]">No application is selected. Pick one from the queue to review it.</p>
            </div>
          ) : detailLoading || !selected ? (
            <div className="space-y-4 p-6">
              <div className="h-14 animate-pulse rounded-xl bg-[#EFE5DA]/60" />
              <div className="h-24 animate-pulse rounded-xl bg-[#EFE5DA]/60" />
              <div className="h-32 animate-pulse rounded-xl bg-[#EFE5DA]/60" />
            </div>
          ) : (
            <div>
              {/* selected header */}
              <div className="border-b border-[#EFE5DA] px-6 py-6">
                <div className="flex items-center gap-3.5">
                  {(() => { const [bg, fg] = avatar(selected.id); return (
                    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold" style={{ background: bg, color: fg }}>
                      {initials(selected.user?.name)}
                    </span>
                  ) })()}
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="font-serif text-[22px] font-semibold text-[#241715]">{selected.user?.name ?? '—'}</p>
                    <p className="text-[13px] text-[#A38A82]">{selected.user?.email ?? '—'}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div className="px-6 py-5">
                {/* meta */}
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#EFE5DA] bg-[#EFE5DA]">
                  {[
                    ['Period', `${selected.academic_year} · ${selected.semester}`],
                    ['Submitted', formatDate(selected.created_at)],
                    ['Email', selected.user?.email ?? '—'],
                    ['Application', `#${selected.id}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white px-4 py-3">
                      <p className="text-[11px] text-[#A38A82]">{label}</p>
                      <p className="truncate text-[13px] font-semibold text-[#2B1E1B]">{value}</p>
                    </div>
                  ))}
                </div>

                {/* documents (review stages) */}
                {documents.length > 0 && status !== 'approved' && status !== 'rejected' && (
                  <div className="mb-5">
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-[#A38A82]">Documents</p>
                    <div className="flex flex-col gap-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2.5 rounded-[10px] border border-[#EFE5DA] px-3.5 py-2.5">
                          <CheckCircle className="h-4 w-4 text-[#4E9657]" />
                          <span className="flex-1 text-[13px] capitalize text-[#3F2F2A]">{doc.document_type.replace(/_/g, ' ')}</span>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-[#7C1B26]">
                            <Eye className="h-3.5 w-3.5" /> View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STATE: submitted → mark under review */}
                {status === 'submitted' && (
                  <div>
                    <div className="mb-4 flex gap-3 rounded-xl border border-[#F0DFAE] bg-[#FFF9EC] px-4 py-3.5">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[#B8860B]" />
                      <p className="text-[12.5px] leading-relaxed text-[#7A5C12]">
                        Move this application to <strong>Under Review</strong> to start processing it and unlock interview scheduling.
                      </p>
                    </div>
                    <button
                      onClick={() => markReview.mutate()}
                      disabled={markReview.isPending}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-[#FFF8F2] shadow-[0_10px_22px_rgba(108,22,32,.24)] disabled:opacity-50"
                    >
                      <Clock className="h-[18px] w-[18px]" /> Mark as Under Review
                    </button>
                  </div>
                )}

                {/* STATE: under_review → schedule interview */}
                {status === 'under_review' && (
                  <div className="mb-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-[#7C1B26]" />
                      <span className="text-[15px] font-bold text-[#241715]">Schedule Interview</span>
                    </div>
                    <div className="mb-3.5 grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5A4A45]">Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={interviewDate}
                          onChange={(e) => setInterviewDate(e.target.value)}
                          className="h-[46px] w-full rounded-[11px] border border-[#EADFD4] bg-[#FBF7F2] px-3 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5A4A45]">Mode</label>
                        <select
                          value={mode}
                          onChange={(e) => {
                            const next = e.target.value as 'in_person' | 'online'
                            setMode(next)
                            if (next === 'in_person' && !location) setLocation(DSA_OFFICE)
                            if (next === 'online' && location === DSA_OFFICE) setLocation('')
                          }}
                          className="h-[46px] w-full rounded-[11px] border border-[#EADFD4] bg-[#FBF7F2] px-3 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                        >
                          <option value="in_person">In Person</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5A4A45]">{mode === 'in_person' ? 'Venue' : 'Meeting Link'}</label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={mode === 'in_person' ? 'Building / office' : 'https://meet.google.com/…'}
                        className="h-[46px] w-full rounded-[11px] border border-[#EADFD4] bg-[#FBF7F2] px-3 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                      />
                    </div>
                    <p className="mb-4 text-xs leading-relaxed text-[#8A7A73]">
                      {mode === 'in_person'
                        ? 'In-person interviews are held at the DSA office. Leave as-is unless it changes.'
                        : 'Share an online meeting link the applicant can join.'}
                    </p>
                    <button
                      onClick={() => scheduleInterview.mutate()}
                      disabled={scheduleInterview.isPending || !interviewDate}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[0_10px_22px_rgba(108,22,32,.2)] disabled:cursor-not-allowed"
                      style={{ background: interviewDate ? 'linear-gradient(180deg,#86202E,#6C1620)' : '#C9AFB2' }}
                    >
                      <CalendarCheck className="h-[18px] w-[18px]" /> Schedule Interview
                    </button>
                  </div>
                )}

                {/* STATE: interview_scheduled → details */}
                {status === 'interview_scheduled' && iv && (
                  <div className="mb-5 rounded-[13px] border border-[#E2D5F0] bg-[#F4EEFA] px-[18px] py-4">
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarCheck className="h-[19px] w-[19px] text-[#6B4E9A]" />
                      <span className="text-[13.5px] font-bold text-[#5A3E86]">Interview Scheduled</span>
                    </div>
                    <div className="flex flex-col gap-2 text-[13px] text-[#3F2F2A]">
                      <span className="flex items-center gap-2.5"><Clock className="h-[17px] w-[17px] text-[#9078AE]" />{formatDateTime(iv.scheduled_at)}</span>
                      <span className="flex items-center gap-2.5">
                        {iv.mode === 'online' ? <Video className="h-[17px] w-[17px] text-[#9078AE]" /> : <Users className="h-[17px] w-[17px] text-[#9078AE]" />}
                        {iv.mode === 'online' ? 'Online' : 'In Person'}
                      </span>
                      <span className="flex items-center gap-2.5"><MapPin className="h-[17px] w-[17px] text-[#9078AE]" />{iv.location || 'Online meeting link'}</span>
                    </div>
                  </div>
                )}

                {/* DECISION — Approve unlocks only after an interview is scheduled; Reject is allowed earlier */}
                {(status === 'under_review' || status === 'interview_scheduled') && (
                  <div>
                    {status === 'under_review' && (
                      <div className="mb-3 flex gap-2.5 rounded-xl border border-[#F0DFAE] bg-[#FFF9EC] px-4 py-2.5 text-[12px] leading-relaxed text-[#7A5C12]">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#B8860B]" />
                        Schedule an interview before approving .
                      </div>
                    )}
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Remarks (required for rejection)"
                      rows={3}
                      className="mb-3 w-full resize-none rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2.5 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                    />
                    <div className="flex gap-2.5">
                      {status === 'interview_scheduled' && (
                        <button
                          onClick={() => decide.mutate('approved')}
                          disabled={decide.isPending}
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3E9C58] to-[#2C7A42] text-sm font-semibold text-white shadow-[0_10px_22px_rgba(44,122,66,.24)] disabled:opacity-50"
                        >
                          <CheckCircle className="h-[18px] w-[18px]" /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => decide.mutate('rejected')}
                        disabled={decide.isPending || !remarks.trim()}
                        className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-[#F0D4D7] bg-[#FCF2F3] text-sm font-semibold text-[#A52834] disabled:opacity-50 ${status === 'interview_scheduled' ? 'px-5' : 'flex-1'}`}
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
                      ? { background: '#EEF7EF', borderColor: '#D6EBD8' }
                      : { background: '#FCF2F3', borderColor: '#F0D4D7' }}
                  >
                    {status === 'approved'
                      ? <BadgeCheck className="h-6 w-6 flex-shrink-0 text-[#2C5A33]" />
                      : <Ban className="h-6 w-6 flex-shrink-0 text-[#A52834]" />}
                    <div className="leading-snug">
                      <p className="text-sm font-bold" style={{ color: status === 'approved' ? '#2C5A33' : '#A52834' }}>
                        {status === 'approved' ? 'Approved — moved to Assignments' : 'Application Rejected'}
                      </p>
                      <p className="text-[12.5px]" style={{ color: status === 'approved' ? '#2C5A33' : '#A52834', opacity: 0.85 }}>
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
    </div>
  )
}
