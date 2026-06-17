'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Calendar, MapPin, Video } from 'lucide-react'
import Link from 'next/link'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationTimeline } from '@/components/application/ApplicationTimeline'
import { formatDateTime } from '@/lib/utils/formatDate'

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: application, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.getApplication(Number(id)),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[#E2E8F0]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#E2E8F0]" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center py-16">
        <p className="text-[#64748B]">Application not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/applicant/dashboard"
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E293B]">
            Application #{application.id}
          </h1>
          <p className="text-sm text-[#64748B]">
            {application.academic_year} — {application.semester}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-[#1E293B]">Status Timeline</h2>
            <ApplicationTimeline application={application} />
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-[#1E293B]">Application Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#64748B]">Academic Year</dt>
                <dd className="font-medium text-[#1E293B]">{application.academic_year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#64748B]">Semester</dt>
                <dd className="font-medium text-[#1E293B]">{application.semester}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#64748B]">Submitted</dt>
                <dd className="font-medium text-[#1E293B]">{formatDateTime(application.created_at)}</dd>
              </div>
              {application.reviewed_at && (
                <div className="flex justify-between">
                  <dt className="text-[#64748B]">Reviewed</dt>
                  <dd className="font-medium text-[#1E293B]">{formatDateTime(application.reviewed_at)}</dd>
                </div>
              )}
              {application.remarks && (
                <div>
                  <dt className="mb-1 text-[#64748B]">Remarks</dt>
                  <dd className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[#1E293B]">{application.remarks}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Interview schedule */}
          {application.interview && (
            <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#1B4F72]" />
                <h2 className="font-semibold text-[#1B4F72]">Interview Scheduled</h2>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                  <div>
                    <dt className="text-[#64748B]">Date &amp; Time</dt>
                    <dd className="font-semibold text-[#1E293B]">{formatDateTime(application.interview.scheduled_at)}</dd>
                  </div>
                </div>

                {application.interview.mode === 'online' ? (
                  <div className="flex items-start gap-2">
                    <Video className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B]">Mode — Online</dt>
                      <dd className="font-semibold text-[#1E293B] break-words">
                        {application.interview.location
                          ? application.interview.location
                          : 'A meeting link will be shared with you.'}
                      </dd>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                    <div>
                      <dt className="text-[#64748B]">Mode — In Person · Venue</dt>
                      <dd className="font-semibold text-[#1E293B]">
                        {application.interview.location ?? 'Office of the Dean of Students Affairs (DSA)'}
                      </dd>
                      <dd className="mt-0.5 text-xs text-[#64748B]">Please arrive at the DSA office on time and bring a valid ID.</dd>
                    </div>
                  </div>
                )}

                {application.interview.notes && (
                  <div className="rounded-lg border border-[#BFDBFE] bg-white px-3 py-2">
                    <dt className="mb-0.5 text-xs text-[#64748B]">Notes</dt>
                    <dd className="text-[#1E293B]">{application.interview.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-[#1E293B]">Uploaded Documents</h2>
              <ul className="space-y-2">
                {application.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1E293B] capitalize">
                        {doc.document_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-[#64748B]">{doc.file_name}</p>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-[#1B4F72] hover:text-[#2980B9] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
