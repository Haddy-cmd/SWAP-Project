'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, ArrowLeft, Clock, Lock } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { settingsApi } from '@/lib/api/settings.api'
import { ApplicationForm } from '@/components/application/ApplicationForm'

const IN_PROGRESS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  interview_scheduled: 'Interview Scheduled',
}

export default function NewApplicationPage() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  const { data: appStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['application-status'],
    queryFn: () => settingsApi.getApplicationStatus(),
  })

  const hasApproved = applications?.some((a) => a.status === 'approved') ?? false
  const inProgress = applications?.find((a) => ['submitted', 'under_review', 'interview_scheduled'].includes(a.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">New Application</h1>
        <p className="mt-1 text-sm text-ink-500">
          Complete all fields and upload the required documents.
        </p>
      </div>

      {isLoading || statusLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-ink-200" />
      ) : appStatus && !appStatus.open ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-25 p-6 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100">
            <Lock className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <p className="font-semibold text-brand-700">Applications Not Yet Open</p>
            <p className="mt-1 text-sm text-ink-500">
              {appStatus.message ?? 'The application period has not started yet. Please check back later.'}
            </p>
            <Link
              href="/applicant/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      ) : hasApproved ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-6 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success-100">
            <CheckCircle className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <p className="font-semibold text-success-800">Application Approved — Awaiting Office Assignment</p>
            <p className="mt-1 text-sm text-success-700">
              Your application has already been approved. Please wait for further announcement regarding
              your office assignment. You&apos;ll be notified once an office and supervisor have been assigned
              to you, so you cannot submit a new application at this time.
            </p>
            <Link
              href="/applicant/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-success-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      ) : inProgress ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-6 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-100">
            <Clock className="h-5 w-5 text-warning-600" />
          </div>
          <div>
            <p className="font-semibold text-warning-800">
              Application In Progress — {IN_PROGRESS_LABEL[inProgress.status] ?? inProgress.status}
            </p>
            <p className="mt-1 text-sm text-warning-700">
              You already have an application for {inProgress.academic_year} — {inProgress.semester} that is still
              being processed. Please wait for it to be reviewed before submitting a new one. You&apos;ll be
              notified of any updates.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/applicant/application/${inProgress.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-warning-600 px-4 py-2 text-xs font-semibold text-white hover:bg-warning-700 transition-colors"
              >
                View Application Status
              </Link>
              <Link
                href="/applicant/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-warning-200 px-4 py-2 text-xs font-semibold text-warning-800 hover:bg-warning-100 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <ApplicationForm />
        </div>
      )}
    </div>
  )
}
