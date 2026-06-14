'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, MapPin, Video } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime } from '@/lib/utils/formatDate'
import Link from 'next/link'

export default function AdminInterviewsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications-interviews', page],
    queryFn: () =>
      applicationsApi.adminListApplications({
        page: String(page),
        status: 'interview_scheduled',
      }),
  })

  const applications = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Scheduled Interviews</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          All applicants with a scheduled interview.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-[#E2E8F0]" />
          ))}
        </div>
      ) : !applications.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] py-16 text-center">
          <Calendar className="h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#94A3B8]">No interviews scheduled.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const interview = app.interview
            return (
              <div
                key={app.id}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1E293B]">{app.user?.name ?? '—'}</p>
                    <p className="text-xs text-[#64748B]">{app.user?.email ?? '—'}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {app.academic_year} — {app.semester}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                {interview && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2 text-sm text-[#64748B]">
                      <Clock className="h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                      <span>{formatDateTime(interview.scheduled_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#64748B]">
                      {interview.mode === 'online' ? (
                        <Video className="h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                      ) : (
                        <MapPin className="h-4 w-4 flex-shrink-0 text-[#1B4F72]" />
                      )}
                      <span className="truncate">{interview.location ?? interview.mode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          interview.mode === 'online'
                            ? 'bg-blue-50 text-[#2980B9]'
                            : 'bg-[#EBF5FB] text-[#1B4F72]'
                        }`}
                      >
                        {interview.mode === 'online' ? 'Online' : 'In Person'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/admin/applications/${app.id}`}
                    className="rounded-lg border border-[#E2E8F0] px-4 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] transition-colors"
                  >
                    View Application
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#64748B]">
            Page {meta.current_page} of {meta.last_page}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === meta.last_page}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
