'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { LogIn, LogOut, CheckCircle, AlertTriangle, FileText } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import { formatDateTime } from '@/lib/utils/formatDate'

type AttendanceMode = 'idle' | 'clocked-in'

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const [openLogId, setOpenLogId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [qrToken, setQrToken] = useState('')

  const { data: summary } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
  })

  // Restore clock-in state from the server so an open log survives reloads / re-login.
  const { data: currentLog } = useQuery({
    queryKey: ['attendance-current'],
    queryFn: () => attendanceApi.getCurrentLog(),
  })

  useEffect(() => {
    if (currentLog) {
      setOpenLogId(currentLog.id)
    }
  }, [currentLog])

  const timeIn = useMutation({
    mutationFn: () => attendanceApi.timeIn(qrToken),
    onSuccess: (res) => {
      setOpenLogId(res.data.id)
      setMessage({ type: 'success', text: `Time-in recorded at ${formatDateTime(res.data.time_in)}` })
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
      setQrToken('')
    },
    onError: (err: { message?: string }) => {
      setMessage({ type: 'error', text: err.message ?? 'Time-in failed. Please try again.' })
    },
  })

  const timeOut = useMutation({
    mutationFn: () => {
      if (!openLogId) throw new Error('No open log')
      return attendanceApi.timeOut(openLogId, qrToken)
    },
    onSuccess: (res) => {
      setOpenLogId(null)
      setMessage({ type: 'success', text: `Time-out recorded at ${formatDateTime(res.data.time_out!)}` })
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
      setQrToken('')
    },
    onError: (err: { message?: string }) => {
      setMessage({ type: 'error', text: err.message ?? 'Time-out failed.' })
    },
  })

  const mode: AttendanceMode = openLogId ? 'clocked-in' : 'idle'
  const completed = !!summary && summary.required > 0 && summary.remaining <= 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Attendance</h1>
        <p className="mt-1 text-sm text-[#64748B]">Enter your QR token to clock in or out.</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-[#27AE60]'
              : 'bg-red-50 text-[#E74C3C]'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div
          className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
            mode === 'clocked-in'
              ? 'bg-green-50 text-[#27AE60]'
              : 'bg-[#F1F5F9] text-[#64748B]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              mode === 'clocked-in' ? 'animate-pulse bg-[#27AE60]' : 'bg-[#94A3B8]'
            }`}
          />
          {mode === 'clocked-in' ? 'Currently Clocked In' : 'Not Clocked In'}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              QR Token
            </label>
            <input
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Paste or scan your QR token"
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm font-mono text-[#1E293B] placeholder-[#94A3B8] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/20"
            />
          </div>

          {mode === 'clocked-in' && (
            currentLog?.has_narrative ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-[#27AE60]">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Narrative report submitted — you can clock out.
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 font-medium text-[#92400E]">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  A narrative report is required before you can clock out.
                </span>
                {openLogId && (
                  <Link
                    href={`/recipient/narrative/${openLogId}`}
                    className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4F72] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2980B9] transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Submit Narrative
                  </Link>
                )}
              </div>
            )
          )}

          {mode === 'idle' && completed && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-[#27AE60]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              You have completed all your required service hours. No further clock-ins are needed.
            </div>
          )}

          <div className="flex gap-3">
            {mode === 'idle' ? (
              <button
                onClick={() => timeIn.mutate()}
                disabled={timeIn.isPending || !qrToken.trim() || completed}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#27AE60] px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                {timeIn.isPending ? 'Recording…' : 'Clock In'}
              </button>
            ) : (
              <button
                onClick={() => timeOut.mutate()}
                disabled={timeOut.isPending || !qrToken.trim() || !currentLog?.has_narrative}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E74C3C] px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {timeOut.isPending ? 'Recording…' : 'Clock Out'}
              </button>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1E293B]">Hours Summary</h2>
          <HoursProgress summary={summary} />
        </div>
      )}
    </div>
  )
}
