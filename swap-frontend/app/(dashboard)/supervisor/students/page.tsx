'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Sparkles, Target, Search, LayoutGrid, List, Building2, FileText, X, TrendingDown, Menu, ClipboardCheck, UserRound, FolderOpen } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { ManualHoursModal, RequiredHoursModal } from '@/components/attendance/HoursModals'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { supervisorApi, type StudentDocument } from '@/lib/api/supervisor.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatHours, formatPercent, toPercent } from '@/lib/utils/formatHours'
import { UNKNOWN_PACE, isBehind, paceDetail, type Pace } from '@/lib/utils/pace'
import { cn } from '@/lib/utils/cn'
import { TERM_FILTERS, TermBadge, matchesTermFilter, type TermFilter } from '@/components/shared/TermBadge'
import { TermReportReviewModal } from '@/components/supervisor/TermReportReview'
import type { TermBadgeValue } from '@/types/assignment.types'

/** Shown when verified hours have fallen behind what the elapsed term expects. */
function BehindBadge({ pace }: { pace: Pace }) {
  if (!isBehind(pace)) return null
  return (
    <span title={paceDetail(pace)}
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
      <TrendingDown className="h-3 w-3" /> Behind pace
    </span>
  )
}

type Row = {
  userId: number
  name: string
  email: string
  office: string
  avatarUrl: string | null
  verified: number
  required: number
  pendingRequired: number | null
  pendingLogs: number
  pace: Pace
  term: TermBadgeValue
  deficientHours: number | null
  /** End-of-term report: submitted and waiting for acceptance, and the mark once accepted. */
  reportToReview: boolean
  reportEligible: boolean | null
}
type Selected = { userId: number; name: string; required: number }

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <UserAvatar name={name} avatarUrl={avatarUrl}
      className="h-11 w-11 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-base font-extrabold text-brand-950" />
  )
}

/** The end-of-term report's state: waiting for acceptance (opens it), or the renewal mark. */
function ReportBadge({ row, onOpen }: { row: Row; onOpen: () => void }) {
  if (row.reportToReview) {
    return (
      <button onClick={onOpen}
        className="rounded-full bg-gold-50 px-2.5 py-0.5 text-[11px] font-semibold text-warning-800 ring-1 ring-gold-200 hover:bg-gold-100">
        Report to review
      </button>
    )
  }
  if (row.reportEligible === null) return null
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
      row.reportEligible ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>
      {row.reportEligible ? 'Eligible for renewal' : 'Not eligible for renewal'}
    </span>
  )
}

function PendingBadges({ row, onReport }: { row: Row; onReport: () => void }) {
  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-1">
      {row.term !== 'in_progress' && <TermBadge badge={row.term} deficientHours={row.deficientHours} />}
      <ReportBadge row={row} onOpen={onReport} />
      <BehindBadge pace={row.pace} />
      {row.pendingLogs > 0 && (
        <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-800">
          {row.pendingLogs} to review
        </span>
      )}
      {row.pendingRequired != null && (
        <Link
          href={`/supervisor/students/${row.userId}/logs`}
          title="Admin requested a required-hours change — review to approve"
          className="rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-800 hover:bg-warning-100"
        >
          → {row.pendingRequired}h pending
        </Link>
      )}
    </div>
  )
}

function Progress({ row }: { row: Row }) {
  const pct = toPercent(row.verified, row.required)
  const width = pct > 0 && pct < 2 ? 2 : pct
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-500">Verified hours</span>
        <span>
          <span className="font-semibold text-success-600">{formatHours(row.verified)}</span>
          <span className="text-ink-350"> / {row.required}h · {formatPercent(row.verified, row.required)}%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-success-600 transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

// Group a student's documents by the term they were submitted for, so a renewal's
// updated COR/grades don't blend into the original application's documents. Backend
// already returns them newest-term-first, so group order is preserved.
function groupDocsByTerm(docs: StudentDocument[]) {
  const groups: { key: string; label: string; type: 'new' | 'renewal'; docs: StudentDocument[] }[] = []
  for (const doc of docs) {
    const key = String(doc.application_id)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      const term = [doc.academic_year, doc.semester].filter(Boolean).join(' · ')
      group = { key, label: term || 'Application requirements', type: doc.type, docs: [] }
      groups.push(group)
    }
    group.docs.push(doc)
  }
  return groups
}

function StudentDocumentsModal({ student, onClose }: { student: Selected; onClose: () => void }) {
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)
  const { data: docs, isLoading } = useQuery({
    queryKey: ['student-documents', student.userId],
    queryFn: () => supervisorApi.getStudentDocuments(student.userId),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">Documents</h2>
            <p className="text-sm text-ink-500">{student.name}&apos;s application requirements</p>
          </div>
          <button onClick={onClose} className="text-ink-350 hover:text-danger-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-200/60" />)}</div>
        ) : !docs?.length ? (
          <p className="py-8 text-center text-sm text-ink-350">No documents on file for this student.</p>
        ) : (
          <div className="space-y-5">
            {groupDocsByTerm(docs).map((group) => (
              <div key={group.key}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{group.label}</p>
                  {group.type === 'renewal' && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">Renewal</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {group.docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3">
                      <p className="text-sm capitalize text-ink-900">{doc.document_type.replace(/_/g, ' ')}</p>
                      <button onClick={() => setViewDoc(doc)} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewDoc && <DocumentViewerModal doc={viewDoc} docs={docs ?? []} onClose={() => setViewDoc(null)} />}
    </div>
  )
}

/** One menu button per student with every action (End-term report opens in a popup). */
function ActionsMenu({ row, onReport, onBonus, onHours, onDocs }: {
  row: Row
  onReport: () => void
  onBonus: () => void
  onHours: () => void
  onDocs: () => void
}) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  // Fixed position, so the list's scroll container never clips the menu; closes on scroll.
  useEffect(() => {
    if (!at) return
    const close = () => setAt(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [at])

  const toggle = () => {
    if (at) return setAt(null)
    const r = button.current!.getBoundingClientRect()
    setAt({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }
  const pick = (fn: () => void) => () => { setAt(null); fn() }
  const ITEM = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink-800 hover:bg-ink-50'

  return (
    <>
      <button ref={button} onClick={toggle} aria-haspopup="menu" aria-expanded={!!at} aria-label={`Actions for ${row.name}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50">
        <Menu className="h-4 w-4" />
        {row.reportToReview && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold-500 ring-2 ring-white" />}
      </button>
      {at && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAt(null)} />
          <div role="menu" style={{ top: at.top, right: at.right }}
            className="fixed z-50 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg">
            <button role="menuitem" onClick={pick(onReport)} className={ITEM}>
              <ClipboardCheck className="h-4 w-4 text-brand-700" /> End-term report
              {row.reportToReview && <span className="ml-auto rounded-full bg-gold-50 px-1.5 text-[10px] font-bold text-warning-800">To review</span>}
            </button>
            <button role="menuitem" onClick={pick(onBonus)} className={ITEM}><Sparkles className="h-4 w-4 text-brand-700" /> Bonus hours</button>
            <button role="menuitem" onClick={pick(onHours)} className={ITEM}><Target className="h-4 w-4 text-brand-700" /> Required hours</button>
            <button role="menuitem" onClick={pick(onDocs)} className={ITEM}><FolderOpen className="h-4 w-4 text-violet-600" /> Documents</button>
            <Link role="menuitem" href={`/supervisor/students/${row.userId}`} onClick={() => setAt(null)} className={ITEM}>
              <UserRound className="h-4 w-4 text-brand-700" /> View profile
            </Link>
          </div>
        </>
      )}
    </>
  )
}

export default function SupervisorStudentsPage() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'cards' | 'list'>('list') // list view is the default
  const [search, setSearch] = useState('')
  const [bonusFor, setBonusFor] = useState<Selected | null>(null)
  const [docsFor, setDocsFor] = useState<Selected | null>(null)
  const [hoursFor, setHoursFor] = useState<Selected | null>(null)
  const [reportFor, setReportFor] = useState<Selected | null>(null)
  const [termFilter, setTermFilter] = useState<TermFilter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })

  const raw = ((data as { data?: unknown[] })?.data ?? []) as Array<Record<string, unknown>>
  const rows: Row[] = raw.map((s) => {
    const user = (s.user ?? {}) as Record<string, unknown>
    return {
      userId: Number(s.user_id ?? s.id ?? 0),
      name: String(user.name ?? '—'),
      email: String(user.email ?? '—'),
      office: String(s.office_name ?? '—'),
      avatarUrl: (user.avatar_url as string | null) ?? null,
      verified: Number(s.verified_hours ?? 0),
      required: Number(s.required_hours ?? 200),
      pendingRequired: s.pending_required_hours != null ? Number(s.pending_required_hours) : null,
      pendingLogs: Number(s.pending_logs_count ?? 0),
      pace: (s.pace as Pace | undefined) ?? UNKNOWN_PACE,
      term: (s.term_badge as TermBadgeValue | undefined) ?? 'in_progress',
      deficientHours: s.deficient_hours != null ? Number(s.deficient_hours) : null,
      reportToReview: Boolean(s.report_to_review),
      reportEligible: ((s.term_report as { renewal_eligible?: boolean | null } | null | undefined)?.renewal_eligible) ?? null,
    }
  })

  const q = search.trim().toLowerCase()
  const filtered = rows
    .filter((r) => matchesTermFilter(r.term, termFilter))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.office.toLowerCase().includes(q))
  const toReview = rows.reduce((n, r) => n + r.pendingLogs, 0)
  const behindCount = rows.filter((r) => isBehind(r.pace)).length

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supervisor-students'] })
    queryClient.invalidateQueries({ queryKey: ['student-summary'] })
    queryClient.invalidateQueries({ queryKey: ['student-logs'] })
  }
  const addBonus = useMutation({
    mutationFn: (v: { hours: number; date: string; reason: string }) => attendanceApi.addManualHours(bonusFor!.userId, v),
    onSuccess: () => { setBonusFor(null); invalidate() },
  })
  const setRequired = useMutation({
    mutationFn: (h: number) => attendanceApi.updateRequiredHours(hoursFor!.userId, h),
    onSuccess: () => { setHoursFor(null); invalidate() },
  })

  const openBonus = (r: Row) => setBonusFor({ userId: r.userId, name: r.name, required: r.required })
  const openHours = (r: Row) => setHoursFor({ userId: r.userId, name: r.name, required: r.required })
  const openReport = (r: Row) => setReportFor({ userId: r.userId, name: r.name, required: r.required })
  const actions = (r: Row) => (
    <ActionsMenu row={r} onReport={() => openReport(r)} onBonus={() => openBonus(r)} onHours={() => openHours(r)}
      onDocs={() => setDocsFor({ userId: r.userId, name: r.name, required: r.required })} />
  )
  const reportsToReview = rows.filter((r) => r.reportToReview).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My Students</h1>
          <p className="mt-1 text-sm text-ink-500">SWAP recipients assigned to you — review end-of-term reports, grant bonus hours or adjust required hours from each student&apos;s menu.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder-ink-400 focus:border-brand-700 focus:outline-none"
            />
          </div>
          {/* View toggle */}
          <div className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-ink-100 p-1">
            {([['cards', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                title={v === 'cards' ? 'Card view' : 'List view'}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-lg transition-colors',
                  view === v ? 'bg-brand-700 text-white shadow-sm' : 'text-ink-500 hover:text-brand-700',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary chips */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-900">{rows.length} students</span>
          {toReview > 0 && (
            <span className="rounded-full border border-warning-200 bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-800">{toReview} logs to review</span>
          )}
          {reportsToReview > 0 && (
            <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-xs font-semibold text-warning-800">
              {reportsToReview} end-of-term report{reportsToReview === 1 ? '' : 's'} to review
            </span>
          )}
          {behindCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-gold-50 px-3 py-1 text-xs font-semibold text-warning-700">
              <TrendingDown className="h-3.5 w-3.5" /> {behindCount} behind pace
            </span>
          )}
          {/* Term verdict filter (Qualified / Deficient once the semester closes) */}
          <div className="ml-auto flex flex-wrap gap-1">
            {TERM_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setTermFilter(f.value)} aria-pressed={termFilter === f.value}
                className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  termFilter === f.value ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 bg-white text-ink-500 hover:text-brand-700')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-44 animate-pulse rounded-2xl bg-ink-200" />)}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300 py-16 text-center">
          <Users className="h-10 w-10 text-ink-300" />
          <p className="text-sm font-medium text-ink-350">{rows.length ? 'No students match your search or filter.' : 'No students assigned yet.'}</p>
        </div>
      ) : view === 'cards' ? (
        /* ── CARD VIEW ── */
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <div key={r.userId} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{r.name}</p>
                    <p className="truncate text-xs text-ink-350">{r.email}</p>
                  </div>
                </div>
                <PendingBadges row={r} onReport={() => openReport(r)} />
              </div>
              <div className="mt-3 border-t border-ink-100 pt-3">
                <p className="flex items-center gap-1.5 text-sm text-ink-500">
                  <Building2 className="h-4 w-4 flex-shrink-0 text-ink-400" />
                  {r.office}
                </p>
                <div className="mt-3"><Progress row={r} /></div>
              </div>
              <div className="mt-4 flex justify-end">{actions(r)}</div>
            </div>
          ))}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">Student</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">Office</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">Progress</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.userId} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink-900">{r.name}</p>
                            {r.pendingLogs > 0 && (
                              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-800">{r.pendingLogs} to review</span>
                            )}
                            {r.term !== 'in_progress' && <TermBadge badge={r.term} deficientHours={r.deficientHours} />}
                            <ReportBadge row={r} onOpen={() => openReport(r)} />
                            <BehindBadge pace={r.pace} />
                          </div>
                          <p className="truncate text-xs text-ink-350">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-500">{r.office}</td>
                    <td className="px-5 py-3">
                      <div className="w-52"><Progress row={r} /></div>
                      {r.pendingRequired != null && (
                        <Link href={`/supervisor/students/${r.userId}/logs`} className="mt-1 inline-block rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-800 hover:bg-warning-100">
                          → {r.pendingRequired}h pending
                        </Link>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">{actions(r)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bonusFor && (
        <ManualHoursModal
          studentName={bonusFor.name}
          isPending={addBonus.isPending}
          error={addBonus.isError ? ((addBonus.error as { message?: string })?.message ?? 'Could not add hours.') : null}
          onClose={() => setBonusFor(null)}
          onSubmit={(v) => addBonus.mutate(v)}
        />
      )}
      {docsFor && (
        <StudentDocumentsModal student={docsFor} onClose={() => setDocsFor(null)} />
      )}
      {reportFor && (
        <TermReportReviewModal studentId={reportFor.userId} studentName={reportFor.name} onClose={() => setReportFor(null)} />
      )}
      {hoursFor && (
        <RequiredHoursModal
          current={hoursFor.required}
          isPending={setRequired.isPending}
          error={setRequired.isError ? ((setRequired.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setHoursFor(null)}
          onSubmit={(h) => setRequired.mutate(h)}
        />
      )}
    </div>
  )
}
