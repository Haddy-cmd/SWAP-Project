'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Clock, CheckCircle } from 'lucide-react'
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
  const hasApproved = applications?.some((a) => a.status === 'approved') ?? false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Track your SWAP application status and documents here.
        </p>
      </div>

      {/* Quick status */}
      {latest && (
        <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs text-ink-500">Latest Application</p>
            <p className="mt-0.5 font-semibold text-ink-900">
              {latest.academic_year} — {latest.semester}
            </p>
          </div>
          <StatusBadge status={latest.status} />
        </div>
      )}

      {/* Approved — awaiting office assignment */}
      {hasApproved && (
        <div className="flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-5 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success-100">
            <CheckCircle className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <p className="font-semibold text-success-800">Application Approved — Awaiting Office Assignment</p>
            <p className="mt-1 text-sm text-success-700">
              Congratulations! Your application has been approved. Please wait for further announcement
              regarding your office assignment. You&apos;ll be notified once an office and supervisor have
              been assigned to you. New applications are unavailable while your assignment is being processed.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        {!hasApproved && (
          <Link
            href="/applicant/application/new"
            className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <Plus className="h-5 w-5 text-brand-700" />
            </div>
            <div>
              <p className="font-semibold text-ink-900">New Application</p>
              <p className="text-xs text-ink-500">Apply for this semester</p>
            </div>
          </Link>
        )}

        <Link
          href="/applicant/documents"
          className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <FileText className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <p className="font-semibold text-ink-900">My Documents</p>
            <p className="text-xs text-ink-500">View uploaded files</p>
          </div>
        </Link>
      </div>

      {/* Applications list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">My Applications</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-ink-200" />
            ))}
          </div>
        ) : !applications?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300 py-12 text-center">
            <Clock className="h-10 w-10 text-ink-300" />
            <p className="text-sm font-medium text-ink-400">No applications yet</p>
            <Link
              href="/applicant/application/new"
              className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
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
