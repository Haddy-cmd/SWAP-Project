'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, MapPinOff, FileText, Target, Sparkles } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ManualHoursModal, RequiredHoursModal } from '@/components/attendance/HoursModals'
import { formatDateTime } from '@/lib/utils/formatDate'
import { formatHours } from '@/lib/utils/formatHours'

export default function StudentLogsPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<'bonus' | 'required' | null>(null)

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['student-logs', studentId],
    queryFn: () => attendanceApi.getStudentLogs(Number(studentId)),
    enabled: !!studentId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['student-logs', studentId] })
    queryClient.invalidateQueries({ queryKey: ['student-summary', studentId] })
    queryClient.invalidateQueries({ queryKey: ['supervisor-students'] })
  }

  const verify = useMutation({
    mutationFn: ({ logId, action, fb }: { logId: number; action: 'verified' | 'rejected'; fb: string }) =>
      attendanceApi.verifyLog(logId, { action, feedback: fb }),
    onSuccess: invalidate,
  })

  const bulkVerify = useMutation({
    mutationFn: (logIds: number[]) => attendanceApi.verifyLogsBulk(logIds),
    onSuccess: () => {
      setSelected(new Set())
      invalidate()
    },
  })

  const addBonus = useMutation({
    mutationFn: (v: { hours: number; date: string; reason: string }) => attendanceApi.addManualHours(Number(studentId), v),
    onSuccess: () => { setModal(null); invalidate() },
  })

  const setRequired = useMutation({
    mutationFn: (hours: number) => attendanceApi.updateRequiredHours(Number(studentId), hours),
    onSuccess: () => { setModal(null); invalidate() },
  })

  const decideRequired = useMutation({
    mutationFn: (action: 'approve' | 'reject') => attendanceApi.decideRequiredHours(Number(studentId), action),
    onSuccess: invalidate,
  })

  const logs = logsData?.data ?? []
  const studentName = logsData?.student?.name
  const requiredHours = logsData?.student?.required_hours ?? 120
  const pendingRequired = logsData?.student?.pending_required_hours ?? null
  const pendingIds = logs.filter((l) => l.status === 'pending_verification').map((l) => l.id)
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id))

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pendingIds))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={`/supervisor/students/${studentId}`}
            className="flex flex-shrink-0 items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="truncate text-xl font-bold text-[#1E293B]">Attendance Logs — {studentName ?? `Student #${studentId}`}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal('bonus')}
            className="flex items-center gap-1.5 rounded-lg bg-[#7D1A1A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#5C1010] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add Bonus Hours
          </button>
          <button
            onClick={() => setModal('required')}
            className="flex items-center gap-1.5 rounded-lg border border-[#EAD9D9] px-3.5 py-2 text-xs font-semibold text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
          >
            <Target className="h-3.5 w-3.5" />
            Required: {requiredHours}h
          </button>
        </div>
      </div>

      {pendingRequired != null && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#F3E2B8] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-[#92400E]">
            <Target className="h-4 w-4 flex-shrink-0" />
            Admin requested changing required hours from <span className="font-bold">{requiredHours}h</span> to <span className="font-bold">{pendingRequired}h</span>.
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => decideRequired.mutate('approve')}
              disabled={decideRequired.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => decideRequired.mutate('reject')}
              disabled={decideRequired.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#E74C3C] hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-[#E2E8F0]" />)}
        </div>
      ) : !logs.length ? (
        <p className="text-sm text-[#94A3B8]">No logs yet.</p>
      ) : (
        <div className="space-y-3">
          {pendingIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#1E293B]">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#27AE60]" />
                Select all pending ({pendingIds.length})
              </label>
              <button
                onClick={() => bulkVerify.mutate([...selected])}
                disabled={selected.size === 0 || bulkVerify.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {bulkVerify.isPending ? 'Verifying…' : `Verify selected (${selected.size})`}
              </button>
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {log.status === 'pending_verification' && (
                    <input
                      type="checkbox"
                      checked={selected.has(log.id)}
                      onChange={() => toggle(log.id)}
                      className="mt-1 h-4 w-4 accent-[#27AE60]"
                    />
                  )}
                  <div>
                  <p className="font-semibold text-[#1E293B]">{log.date}</p>
                  <p className="mt-0.5 text-sm text-[#64748B]">
                    {formatDateTime(log.time_in)}
                    {log.time_out && ` → ${formatDateTime(log.time_out)}`}
                    {log.duration_hours != null && ` · ${formatHours(log.duration_hours)}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {log.is_manual && (
                      <span
                        title={log.manual_reason ?? undefined}
                        className="inline-flex items-center gap-1 rounded-full bg-[#FEF0F0] px-2 py-0.5 text-xs font-medium text-[#7D1A1A]"
                      >
                        <Sparkles className="h-3 w-3" />
                        Bonus hours
                      </span>
                    )}
                    {log.location_flagged && (
                      <span
                        title="The GPS reading at clock-in/out was weak or untrusted. Review before verifying."
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[#92400E]"
                      >
                        <MapPinOff className="h-3 w-3" />
                        Location unverified
                      </span>
                    )}
                  </div>
                  </div>
                </div>
                <StatusBadge status={log.status} />
              </div>

              {/* Narrative report */}
              {log.narrative_report ? (
                <details className="group mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-[#1B4F72]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      View narrative report
                    </span>
                    <span className="text-[#94A3B8] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="space-y-2.5 border-t border-[#E2E8F0] px-3 py-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#64748B]">Summary of work</p>
                      <p className="mt-0.5 whitespace-pre-line text-[#1E293B]">{log.narrative_report.content}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#64748B]">Activities done</p>
                      <p className="mt-0.5 whitespace-pre-line text-[#1E293B]">{log.narrative_report.activities_done}</p>
                    </div>
                    {log.narrative_report.challenges && (
                      <div>
                        <p className="font-semibold text-[#64748B]">Challenges</p>
                        <p className="mt-0.5 whitespace-pre-line text-[#1E293B]">{log.narrative_report.challenges}</p>
                      </div>
                    )}
                  </div>
                </details>
              ) : log.is_manual ? (
                log.manual_reason && (
                  <p className="mt-3 rounded-lg bg-[#FEF0F0] px-3 py-2 text-xs text-[#7D1A1A]">
                    <span className="font-semibold">Bonus:</span> {log.manual_reason}
                  </p>
                )
              ) : (
                log.status !== 'open' && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-[#92400E]">
                    No narrative report submitted for this log.
                  </p>
                )
              )}

              {log.status === 'pending_verification' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={feedback[log.id] ?? ''}
                    onChange={(e) => setFeedback((p) => ({ ...p, [log.id]: e.target.value }))}
                    placeholder="Optional feedback…"
                    className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs text-[#1E293B] focus:border-[#1B4F72] focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => verify.mutate({ logId: log.id, action: 'verified', fb: feedback[log.id] ?? '' })}
                      disabled={verify.isPending}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#27AE60] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Verify
                    </button>
                    <button
                      onClick={() => verify.mutate({ logId: log.id, action: 'rejected', fb: feedback[log.id] ?? '' })}
                      disabled={verify.isPending || !feedback[log.id]?.trim()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#E74C3C] px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {log.rejection_reason && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-[#E74C3C]">
                  Reason: {log.rejection_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'bonus' && (
        <ManualHoursModal
          studentName={studentName}
          isPending={addBonus.isPending}
          error={addBonus.isError ? ((addBonus.error as { message?: string })?.message ?? 'Could not add hours.') : null}
          onClose={() => setModal(null)}
          onSubmit={(v) => addBonus.mutate(v)}
        />
      )}
      {modal === 'required' && (
        <RequiredHoursModal
          current={requiredHours}
          isPending={setRequired.isPending}
          error={setRequired.isError ? ((setRequired.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setModal(null)}
          onSubmit={(h) => setRequired.mutate(h)}
        />
      )}
    </div>
  )
}
