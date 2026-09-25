'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, Calendar, MapPin, Video } from 'lucide-react'
import Link from 'next/link'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationTimeline } from '@/components/application/ApplicationTimeline'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { formatDateTime } from '@/lib/utils/formatDate'

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)

  const { data: application, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.getApplication(Number(id)),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-48 animate-pulse rounded-2xl bg-ink-200" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-500">Application not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/applicant/dashboard"
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink-900">
            Application #{application.id}
          </h1>
          <p className="text-sm text-ink-500">
            {application.academic_year} — {application.semester}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-ink-900">Status Timeline</h2>
            <ApplicationTimeline application={application} />
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-ink-900">Application Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Academic Year</dt>
                <dd className="font-medium text-ink-900">{application.academic_year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Semester</dt>
                <dd className="font-medium text-ink-900">{application.semester}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Submitted</dt>
                <dd className="font-medium text-ink-900">{formatDateTime(application.created_at)}</dd>
              </div>
              {application.reviewed_at && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Reviewed</dt>
                  <dd className="font-medium text-ink-900">{formatDateTime(application.reviewed_at)}</dd>
                </div>
              )}
              {application.remarks && (
                <div>
                  <dt className="mb-1 text-ink-500">Remarks</dt>
                  <dd className="rounded-lg bg-ink-50 px-3 py-2 text-ink-900">{application.remarks}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Interview schedule */}
          {application.interview && (
            <div className="rounded-2xl border border-info-200 bg-info-50 p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-700" />
                <h2 className="font-semibold text-brand-700">Interview Scheduled</h2>
              </div>
              {application.interview.status === 'no_show' && (
                <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800">
                  Our records show you missed this interview. Please contact the DSA office — a new schedule may be arranged.
                </div>
              )}
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
                  <div>
                    <dt className="text-ink-500">Date &amp; Time</dt>
                    <dd className="font-semibold text-ink-900">{formatDateTime(application.interview.scheduled_at)}</dd>
                  </div>
                </div>

                {application.interview.mode === 'online' ? (
                  <div className="flex items-start gap-2">
                    <Video className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
                    <div className="min-w-0">
                      <dt className="text-ink-500">Mode — Online</dt>
                      <dd className="font-semibold text-ink-900 break-words">
                        {application.interview.location
                          ? application.interview.location
                          : 'A meeting link will be shared with you.'}
                      </dd>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
                    <div>
                      <dt className="text-ink-500">Mode — In Person · Venue</dt>
                      <dd className="font-semibold text-ink-900">
                        {application.interview.location ?? 'Office of the Dean of Student Affairs (DSA)'}
                      </dd>
                      <dd className="mt-0.5 text-xs text-ink-500">Please arrive at the DSA office on time and bring a valid ID.</dd>
                    </div>
                  </div>
                )}

                {application.interview.notes && (
                  <div className="rounded-lg border border-info-200 bg-white px-3 py-2">
                    <dt className="mb-0.5 text-xs text-ink-500">Notes</dt>
                    <dd className="text-ink-900">{application.interview.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-ink-900">Uploaded Documents</h2>
              <ul className="space-y-2">
                {application.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-900 capitalize">
                        {doc.document_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-ink-500">{doc.file_name}</p>
                    </div>
                    <button
                      onClick={() => setViewDoc(doc)}
                      className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {viewDoc && <DocumentViewerModal doc={viewDoc} docs={application.documents ?? []} onClose={() => setViewDoc(null)} />}
    </div>
  )
}
