'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Building2, UserCog, CheckCircle, Clock, XCircle, Lock, Send } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'
import { attendanceApi } from '@/lib/api/attendance.api'
import { applicationsApi } from '@/lib/api/applications.api'
import { DocumentUpload } from '@/components/application/DocumentUpload'
import type { ApiError } from '@/types/api.types'

export default function RenewalPage() {
  const queryClient = useQueryClient()
  const [cor, setCor] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['application-status'],
    queryFn: () => settingsApi.getApplicationStatus(),
  })

  const { data: assignment } = useQuery({
    queryKey: ['my-assignment'],
    queryFn: () => attendanceApi.getMyAssignment(),
  })

  const { data: myRenewal, isLoading: appsLoading } = useQuery({
    queryKey: ['my-renewal'],
    queryFn: () => applicationsApi.getMyRenewal(),
  })

  const renewal = status?.renewal
  const target = renewal?.open && renewal.academic_year && renewal.semester
    ? { year: renewal.academic_year, semester: renewal.semester }
    : null

  // The renewal submission for the target term, if one exists already.
  const existing = target ? myRenewal ?? undefined : undefined

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('cor', cor!)
      return applicationsApi.submitRenewal(fd)
    },
    onSuccess: () => {
      setCor(null)
      queryClient.invalidateQueries({ queryKey: ['my-renewal'] })
    },
    onError: (err: ApiError) => setError(err.message ?? 'Could not submit your renewal. Please try again.'),
  })

  const loading = statusLoading || appsLoading

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Semester Renewal</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Continue your assistantship for the next term by submitting your updated Certificate of Registration (COR).
        </p>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse rounded-2xl bg-[#EAD9D9]/50" />
      ) : !target ? (
        /* window closed */
        <div className="flex items-start gap-3 rounded-2xl border border-[#E2D2D2] bg-[#FBF4F4] p-6 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F3E3E3]">
            <Lock className="h-5 w-5 text-[#7D1A1A]" />
          </div>
          <div>
            <p className="font-semibold text-[#7D1A1A]">Renewal Not Yet Open</p>
            <p className="mt-1 text-sm text-[#9A6A6A]">
              The DSA office hasn&apos;t opened the renewal window yet. You&apos;ll be able to submit your updated COR here once it opens.
            </p>
          </div>
        </div>
      ) : existing ? (
        /* already submitted for the target term */
        <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              existing.status === 'approved' ? 'bg-green-50' : existing.status === 'rejected' ? 'bg-red-50' : 'bg-[#FFF7ED]'
            }`}>
              {existing.status === 'approved' ? <CheckCircle className="h-5 w-5 text-[#27AE60]" />
                : existing.status === 'rejected' ? <XCircle className="h-5 w-5 text-[#E74C3C]" />
                : <Clock className="h-5 w-5 text-[#D97706]" />}
            </div>
            <div>
              <p className="font-semibold text-[#1E293B]">
                {existing.status === 'approved' && 'Renewal Approved — Welcome Back!'}
                {existing.status === 'rejected' && 'Renewal Not Approved'}
                {existing.status !== 'approved' && existing.status !== 'rejected' && 'Renewal Submitted — Under Review'}
              </p>
              <p className="mt-1 text-sm text-[#8A6A6A]">
                {existing.status === 'approved'
                  ? `Your assignment for ${target.year} — ${target.semester} is active. Check your dashboard for your office and supervisor.`
                  : existing.status === 'rejected'
                  ? (existing.remarks || 'Please coordinate with the DSA office for details.')
                  : `Your updated COR for ${target.year} — ${target.semester} is with the DSA office. You'll be notified once it's decided.`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* renewal form */
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-[#D6EBD8] bg-[#EEF7EF] p-5">
            <RefreshCw className="mt-0.5 h-5 w-5 flex-none text-[#4E9657]" />
            <p className="text-sm text-[#2C5A33]">
              Renewal is open for <span className="font-bold">{target.year} — {target.semester}</span>.
              Upload your updated COR to keep your slot — no interview needed for returning recipients.
            </p>
          </div>

          {assignment && (
            <div className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#A38A82]">Your current placement</p>
              <div className="space-y-2 text-sm text-[#5A4A45]">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#B79B7E]" /> {assignment.office?.name ?? '—'}</p>
                <p className="flex items-center gap-2"><UserCog className="h-4 w-4 text-[#B79B7E]" /> {assignment.supervisor?.name ?? 'Unassigned'}</p>
              </div>
              <p className="mt-3 text-xs text-[#A38A82]">
                If approved, you&apos;ll continue at the same office with the same supervisor.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm">
            <DocumentUpload
              label={`Updated COR for ${target.year} — ${target.semester}`}
              value={cor}
              onChange={setCor}
              error={undefined}
            />

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#E74C3C]">{error}</p>}

            <button
              onClick={() => { setError(null); submit.mutate() }}
              disabled={!cor || submit.isPending}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(108,22,32,.26)] hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              <Send className="h-4 w-4" />
              {submit.isPending ? 'Submitting…' : 'Submit Renewal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
