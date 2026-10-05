'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Clock, CheckCircle, CalendarClock, MapPin, Video, Lock, Info } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { applicationsApi } from '@/lib/api/applications.api'
import { settingsApi } from '@/lib/api/settings.api'
import { ApplicationCard } from '@/components/application/ApplicationCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApplicationTimeline } from '@/components/application/ApplicationTimeline'
import { formatDateTime } from '@/lib/utils/formatDate'

export default function ApplicantDashboard() {
  const { user } = useAuthStore()

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  // Whether new applications are being accepted (the backend refuses them otherwise).
  const { data: period } = useQuery({ queryKey: ['application-status'], queryFn: () => settingsApi.getApplicationStatus() })

  const latest = applications?.[0]
  // Waiting for an office assignment: the latest application is an approved new one. A former
  // recipient's old approval doesn't count once their renewal was rejected (same rule as the API).
  const hasApproved = !!latest && latest.status === 'approved' && latest.type !== 'renewal'
  const renewalRejected = !!latest && latest.type === 'renewal' && latest.status === 'rejected'

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

      {/* The latest application's progress, dated, and its interview */}
      {latest && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-ink-900">Application Progress</h2>
            <ApplicationTimeline application={latest} />
          </div>
          {latest.interview && (
            <div className="self-start rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><CalendarClock className="h-4 w-4 text-brand-700" /> Interview</h2>
              <p className="text-sm font-semibold text-ink-900">{formatDateTime(latest.interview.scheduled_at)}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-600">
                {latest.interview.mode === 'online'
                  ? <><Video className="mt-0.5 h-4 w-4 flex-none" /> Online{latest.interview.meeting_link ? ' — the link is on your application page' : ''}</>
                  : <><MapPin className="mt-0.5 h-4 w-4 flex-none" /> {latest.interview.location || 'In person'}</>}
              </p>
              {latest.interview.status === 'no_show' && (
                <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700">Marked as a no-show. Watch for a new schedule from the DSA.</p>
              )}
              <Link href={`/applicant/application/${latest.id}`} className="mt-4 inline-block text-xs font-semibold text-brand-700 hover:underline">View application</Link>
            </div>
          )}
        </div>
      )}

      {/* Back from a rejected renewal: what they can do now */}
      {renewalRejected && (
        <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-5">
          <Info className="mt-0.5 h-5 w-5 flex-none text-brand-700" />
          <p className="text-sm text-ink-700">
            Your renewal for {latest!.semester} {latest!.academic_year} was not approved, so your account is now an applicant account.
            You can apply again as a new applicant while the application period is open.
          </p>
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
        {!hasApproved && (period?.open === false ? (
          // Closed until the DSA opens the application period (the API refuses with the same message).
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-5">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink-100">
              <Lock className="h-5 w-5 text-ink-400" />
            </div>
            <div>
              <p className="font-semibold text-ink-600">New Application</p>
              <p className="text-xs text-ink-500">{period.message || 'The application period has not started yet.'}</p>
            </div>
          </div>
        ) : (
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
        ))}

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
