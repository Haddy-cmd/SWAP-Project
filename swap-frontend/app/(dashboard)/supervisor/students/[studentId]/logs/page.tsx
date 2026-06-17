'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, MapPinOff } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime } from '@/lib/utils/formatDate'
import { formatHours } from '@/lib/utils/formatHours'

export default function StudentLogsPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())

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

  const logs = logsData?.data ?? []
  const studentName = logsData?.student?.name
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
      <div className="flex items-center gap-4">
        <Link
          href={`/supervisor/students/${studentId}`}
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1B4F72] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-bold text-[#1E293B]">Attendance Logs — {studentName ?? `Student #${studentId}`}</h1>
      </div>

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
                  {log.location_flagged && (
                    <span
                      title="The GPS reading at clock-in/out was weak or untrusted. Review before verifying."
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[#92400E]"
                    >
                      <MapPinOff className="h-3 w-3" />
                      Location unverified
                    </span>
                  )}
                  </div>
                </div>
                <StatusBadge status={log.status} />
              </div>

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
    </div>
  )
}
