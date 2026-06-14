'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Clock } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { applicationsApi } from '@/lib/api/applications.api'
import { ApplicationCard } from '@/components/application/ApplicationCard'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function ApplicantDashboard() {
  const { user } = useAuthStore()

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  const latest = applications?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          Track your SWAP application status and documents here.
        </p>
      </div>

      {/* Quick status */}
      {latest && (
        <div className="flex items-center justify-between rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs text-[#8A6A6A]">Latest Application</p>
            <p className="mt-0.5 font-semibold text-[#1E293B]">
              {latest.academic_year} — {latest.semester}
            </p>
          </div>
          <StatusBadge status={latest.status} />
        </div>
      )}

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/applicant/application/new"
          className="flex items-center gap-3 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF0F0]">
            <Plus className="h-5 w-5 text-[#7D1A1A]" />
          </div>
          <div>
            <p className="font-semibold text-[#1E293B]">New Application</p>
            <p className="text-xs text-[#8A6A6A]">Apply for this semester</p>
          </div>
        </Link>

        <Link
          href="/applicant/documents"
          className="flex items-center gap-3 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF0F0]">
            <FileText className="h-5 w-5 text-[#7D1A1A]" />
          </div>
          <div>
            <p className="font-semibold text-[#1E293B]">My Documents</p>
            <p className="text-xs text-[#8A6A6A]">View uploaded files</p>
          </div>
        </Link>
      </div>

      {/* Applications list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#1E293B]">My Applications</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-[#EAD9D9]" />
            ))}
          </div>
        ) : !applications?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#DCC5C5] py-12 text-center">
            <Clock className="h-10 w-10 text-[#DCC5C5]" />
            <p className="text-sm font-medium text-[#B09A9A]">No applications yet</p>
            <Link
              href="/applicant/application/new"
              className="rounded-lg bg-[#7D1A1A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#A52020] transition-colors"
            >
              Submit your first application
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                href={`/applicant/application/${app.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
