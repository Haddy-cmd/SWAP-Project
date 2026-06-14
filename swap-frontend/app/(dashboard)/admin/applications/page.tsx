'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils/formatDate'

export default function AdminApplicationsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications', page, search, status],
    queryFn: () =>
      applicationsApi.adminListApplications({
        page: String(page),
        ...(search && { search }),
        ...(status && { status }),
      }),
  })

  const applications = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Applications</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B09A9A]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search applicants…"
            className="w-full rounded-xl border border-[#DCC5C5] bg-white py-2.5 pl-9 pr-4 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="interview_scheduled">Interview Scheduled</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#EAD9D9] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#EAD9D9]" />)}
          </div>
        ) : !applications.length ? (
          <p className="p-8 text-center text-sm text-[#B09A9A]">No applications found.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-[#EAD9D9] bg-[#FAF7F7]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Applicant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#8A6A6A]">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-[#F5EDEC] last:border-0 hover:bg-[#FAF7F7]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1E293B]">{app.user?.name ?? '—'}</p>
                      <p className="text-xs text-[#B09A9A]">{app.user?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-[#8A6A6A]">
                      {app.academic_year} — {app.semester}
                    </td>
                    <td className="px-4 py-3 text-[#8A6A6A]">{formatDate(app.created_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-[#EAD9D9] px-4 py-3">
                <p className="text-xs text-[#8A6A6A]">
                  Page {meta.current_page} of {meta.last_page} · {meta.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === meta.last_page}
                    className="rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
