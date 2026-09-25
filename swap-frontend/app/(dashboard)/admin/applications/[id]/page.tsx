'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Eye, Calendar } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationTimeline } from '@/components/application/ApplicationTimeline'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { formatDateTime } from '@/lib/utils/formatDate'
import {
  manilaToday, manilaNowMinutes, manilaToISO, minutesToLabel,
  slotsFor, slotViolation, windowFor, type InterviewMode,
} from '@/lib/utils/interviewWindow'

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const DSA_OFFICE = 'Office of the Dean of Students Affairs (DSA)'
  // Online interviews are usually hosted from the DSA, so it is offered as a venue there too.
  const DSA_DIVISION = 'Division of Student Affairs (DSA)'
  const ONLINE_VENUES = [DSA_DIVISION, DSA_OFFICE, 'Remote / Applicant’s location']
  const [remarks, setRemarks] = useState('')
  const [interviewDay, setInterviewDay] = useState('')
  const [slotMinute, setSlotMinute] = useState<number | null>(null)
  const [duration, setDuration] = useState(30)
  const [location, setLocation] = useState(DSA_OFFICE)
  const [meetingLink, setMeetingLink] = useState('')
  const [mode, setMode] = useState<InterviewMode>('in_person')
  const [modeNotice, setModeNotice] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)

  const slotIssue = slotViolation(interviewDay, slotMinute, mode, duration)
  const canSchedule = !!interviewDay && slotMinute !== null && !slotIssue && (mode !== 'online' || !!meetingLink.trim())

  /**
   * Switching mode can invalidate what was already picked — a Saturday becomes
   * illegal for face-to-face, a 10 PM slot illegal once it is no longer online.
   * Drop just the invalid part and say why.
   */
  const changeMode = (next: InterviewMode) => {
    setMode(next)
    setScheduleError(null)

    const issue = slotViolation(interviewDay, slotMinute, next, duration)
    if (issue) {
      setModeNotice(`${issue} Your previous selection was cleared.`)
      if (interviewDay && slotViolation(interviewDay, null, next, duration)) setInterviewDay('')
      setSlotMinute(null)
    } else {
      setModeNotice(null)
    }

    // Keep the venue sensible for the new mode.
    if (next === 'in_person') {
      setMeetingLink('')
      if (!location || !ONLINE_VENUES.includes(location)) setLocation(DSA_OFFICE)
      else setLocation(DSA_OFFICE)
    } else if (!ONLINE_VENUES.includes(location)) {
      setLocation(DSA_DIVISION)
    }
  }

  const { data: application, isLoading } = useQuery({
    queryKey: ['admin-application', id],
    queryFn: () => applicationsApi.adminGetApplication(Number(id)),
    enabled: !!id,
  })

  const markReview = useMutation({
    mutationFn: () => applicationsApi.adminMarkUnderReview(Number(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-application', id] }),
  })

  const scheduleInterview = useMutation({
    mutationFn: () =>
      applicationsApi.adminScheduleInterview(Number(id), {
        scheduled_at: manilaToISO(interviewDay, slotMinute as number),
        duration_minutes: duration,
        location,
        ...(mode === 'online' ? { meeting_link: meetingLink.trim() } : {}),
        mode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-application', id] })
      setInterviewDay('')
      setSlotMinute(null)
      setScheduleError(null)
      setModeNotice(null)
    },
    onError: (err: { message?: string; errors?: Record<string, string[]> }) => {
      const first = err.errors && Object.values(err.errors)[0]?.[0]
      setScheduleError(first || err.message || 'Could not schedule the interview.')
    },
  })

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      applicationsApi.adminDecideApplication(Number(id), { decision, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-application', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
      router.push('/admin/applications')
    },
  })

  if (isLoading || !application) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-48 animate-pulse rounded-2xl bg-ink-200" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/applications" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink-900">Application #{application.id}</h1>
          <p className="text-sm text-ink-500">{application.user?.name}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-ink-900">Timeline</h2>
            <ApplicationTimeline application={application} />
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {/* Info */}
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-ink-900">Applicant Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-500">Name</dt><dd className="font-medium text-ink-900">{application.user?.name ?? '—'}</dd></div>
              <div><dt className="text-ink-500">Email</dt><dd className="font-medium text-ink-900">{application.user?.email ?? '—'}</dd></div>
              <div><dt className="text-ink-500">Academic Year</dt><dd className="font-medium text-ink-900">{application.academic_year}</dd></div>
              <div><dt className="text-ink-500">Semester</dt><dd className="font-medium text-ink-900">{application.semester}</dd></div>
              <div><dt className="text-ink-500">Submitted</dt><dd className="font-medium text-ink-900">{formatDateTime(application.created_at)}</dd></div>
            </dl>
          </div>

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-ink-900">Documents</h2>
              <ul className="space-y-2">
                {application.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3">
                    <p className="text-sm capitalize text-ink-900">{doc.document_type.replace(/_/g, ' ')}</p>
                    <button onClick={() => setViewDoc(doc)} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {application.status === 'submitted' && (
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-ink-900">Action</h2>
              <button
                onClick={() => markReview.mutate()}
                disabled={markReview.isPending}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                Mark as Under Review
              </button>
            </div>
          )}

          {application.status === 'under_review' && (
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-ink-900">Schedule Interview</h2>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Interview Mode</label>
                <select value={mode} onChange={(e) => changeMode(e.target.value as InterviewMode)}
                  className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="in_person">Face-to-Face</option>
                  <option value="online">Online</option>
                </select>
                <p className="mt-1 text-xs text-ink-500">
                  {mode === 'in_person'
                    ? 'Monday to Friday, between 7:00 AM and 5:00 PM (Asia/Manila).'
                    : 'Any day, between 8:00 AM and 11:00 PM (Asia/Manila).'}
                </p>
              </div>

              {modeNotice && (
                <p className="rounded-xl bg-warning-50 px-3 py-2 text-xs text-warning-800">{modeNotice}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Date</label>
                  <input
                    type="date"
                    value={interviewDay}
                    min={manilaToday()}
                    onChange={(e) => { setInterviewDay(e.target.value); setModeNotice(null); setScheduleError(null) }}
                    className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Start time</label>
                  <select
                    value={slotMinute ?? ''}
                    disabled={!interviewDay}
                    onChange={(e) => { setSlotMinute(e.target.value === '' ? null : Number(e.target.value)); setModeNotice(null); setScheduleError(null) }}
                    className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">{interviewDay ? 'Select a time' : 'Pick a date first'}</option>
                    {slotsFor(mode, duration).map((m) => {
                      // Slots already gone by in Manila are not selectable today.
                      const past = interviewDay === manilaToday() && m <= manilaNowMinutes()
                      return (
                        <option key={m} value={m} disabled={past}>
                          {minutesToLabel(m)}{past ? ' — passed' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Duration</label>
                  <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setSlotMinute(null) }}
                    className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none">
                    {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                  <p className="mt-1 text-xs text-ink-500">Must finish by {minutesToLabel(windowFor(mode).endMinute)}.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Venue</label>
                  {mode === 'online' ? (
                    <select value={location} onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none">
                      {ONLINE_VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder={DSA_OFFICE}
                      className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
                  )}
                </div>
              </div>

              {mode === 'online' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Meeting Link</label>
                  <input value={meetingLink} onChange={(e) => { setMeetingLink(e.target.value); setScheduleError(null) }}
                    placeholder="https://meet.example.com/…"
                    className="w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
                  {!meetingLink.trim() && <p className="mt-1 text-xs text-ink-500">An online interview needs a meeting link.</p>}
                </div>
              )}

              {slotIssue && <p className="text-xs font-medium text-danger-600">{slotIssue}</p>}
              {scheduleError && <p className="text-xs font-medium text-danger-600">{scheduleError}</p>}

              <button onClick={() => scheduleInterview.mutate()} disabled={scheduleInterview.isPending || !canSchedule}
                className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                <Calendar className="h-4 w-4" />
                Schedule Interview
              </button>
            </div>
          )}

          {(application.status === 'under_review' || application.status === 'interview_scheduled') && (
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-ink-900">Decision</h2>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks (required for rejection)"
                rows={3}
                className="w-full resize-none rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
              <div className="flex gap-3">
                <button onClick={() => decide.mutate('approved')} disabled={decide.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-success-700 disabled:opacity-50 transition-colors">
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button onClick={() => decide.mutate('rejected')} disabled={decide.isPending || !remarks.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-danger-700 disabled:opacity-50 transition-colors">
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {viewDoc && <DocumentViewerModal doc={viewDoc} docs={application.documents ?? []} onClose={() => setViewDoc(null)} />}
    </div>
  )
}
