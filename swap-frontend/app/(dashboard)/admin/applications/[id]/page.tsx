'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Eye, Calendar } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationTimeline } from '@/components/application/ApplicationTimeline'
import { formatDateTime } from '@/lib/utils/formatDate'

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const DSA_OFFICE = 'Office of the Dean of Students Affairs (DSA)'
  const [remarks, setRemarks] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [location, setLocation] = useState(DSA_OFFICE)
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person')

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
        scheduled_at: interviewDate,
        location,
        mode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-application', id] })
      setInterviewDate('')
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
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[#E2E8F0]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#E2E8F0]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/applications" className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E293B]">Application #{application.id}</h1>
          <p className="text-sm text-[#64748B]">{application.user?.name}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-[#1E293B]">Timeline</h2>
            <ApplicationTimeline application={application} />
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {/* Info */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-[#1E293B]">Applicant Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[#64748B]">Name</dt><dd className="font-medium text-[#1E293B]">{application.user?.name ?? '—'}</dd></div>
              <div><dt className="text-[#64748B]">Email</dt><dd className="font-medium text-[#1E293B]">{application.user?.email ?? '—'}</dd></div>
              <div><dt className="text-[#64748B]">Academic Year</dt><dd className="font-medium text-[#1E293B]">{application.academic_year}</dd></div>
              <div><dt className="text-[#64748B]">Semester</dt><dd className="font-medium text-[#1E293B]">{application.semester}</dd></div>
              <div><dt className="text-[#64748B]">Submitted</dt><dd className="font-medium text-[#1E293B]">{formatDateTime(application.created_at)}</dd></div>
            </dl>
          </div>

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-[#1E293B]">Documents</h2>
              <ul className="space-y-2">
                {application.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-4 py-3">
                    <p className="text-sm capitalize text-[#1E293B]">{doc.document_type.replace(/_/g, ' ')}</p>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#1B4F72] hover:text-[#2980B9] transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {application.status === 'submitted' && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-[#1E293B]">Action</h2>
              <button
                onClick={() => markReview.mutate()}
                disabled={markReview.isPending}
                className="rounded-xl bg-[#2980B9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1B4F72] disabled:opacity-50 transition-colors"
              >
                Mark as Under Review
              </button>
            </div>
          )}

          {application.status === 'under_review' && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-[#1E293B]">Schedule Interview</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Date & Time</label>
                  <input type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Mode</label>
                  <select value={mode} onChange={(e) => {
                    const next = e.target.value as 'in_person' | 'online'
                    setMode(next)
                    // Default an in-person venue to the DSA office; clear it for online links.
                    if (next === 'in_person' && (!location || location === '')) setLocation(DSA_OFFICE)
                    if (next === 'online' && location === DSA_OFFICE) setLocation('')
                  }}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none">
                    <option value="in_person">In Person</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">
                  {mode === 'in_person' ? 'Venue' : 'Meeting link'}
                </label>
                <input value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder={mode === 'in_person' ? 'Office of the Dean of Students Affairs (DSA)' : 'https://meet.example.com/…'}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
                {mode === 'in_person' && (
                  <p className="mt-1 text-xs text-[#64748B]">In-person interviews are held at the DSA office. Leave as-is unless it changes.</p>
                )}
              </div>
              <button onClick={() => scheduleInterview.mutate()} disabled={scheduleInterview.isPending || !interviewDate}
                className="flex items-center gap-2 rounded-xl bg-[#1B4F72] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2980B9] disabled:opacity-50 transition-colors">
                <Calendar className="h-4 w-4" />
                Schedule Interview
              </button>
            </div>
          )}

          {(application.status === 'under_review' || application.status === 'interview_scheduled') && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-[#1E293B]">Decision</h2>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks (required for rejection)"
                rows={3}
                className="w-full resize-none rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
              <div className="flex gap-3">
                <button onClick={() => decide.mutate('approved')} disabled={decide.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#27AE60] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button onClick={() => decide.mutate('rejected')} disabled={decide.isPending || !remarks.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
