'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { ApplicationForm } from '@/components/application/ApplicationForm'

export default function NewApplicationPage() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  const hasApproved = applications?.some((a) => a.status === 'approved') ?? false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">New Application</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Complete all fields and upload the required documents.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[#E2E8F0]" />
      ) : hasApproved ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-6 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7]">
            <CheckCircle className="h-5 w-5 text-[#16A34A]" />
          </div>
          <div>
            <p className="font-semibold text-[#166534]">Application Approved — Awaiting Office Assignment</p>
            <p className="mt-1 text-sm text-[#15803D]">
              Your application has already been approved. Please wait for further announcement regarding
              your office assignment. You&apos;ll be notified once an office and supervisor have been assigned
              to you, so you cannot submit a new application at this time.
            </p>
            <Link
              href="/applicant/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <ApplicationForm />
        </div>
      )}
    </div>
  )
}
