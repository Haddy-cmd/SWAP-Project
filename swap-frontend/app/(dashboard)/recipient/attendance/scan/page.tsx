'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { QrScanner } from '@/components/attendance/QrScanner'
import { SelfieCapture } from '@/components/attendance/SelfieCapture'
import { NarrativeModal } from '@/components/attendance/NarrativeModal'
import { ClockConfirmSheet, type ClockChoice } from '@/components/attendance/ClockConfirmSheet'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getBestPosition } from '@/lib/utils/geolocation'
import { qrTokenFrom } from '@/lib/utils/qr'
import { BackLink } from '@/components/shared/BackLink'
import type { TimeLog } from '@/types/attendance.types'

const coordsOrNothing = async () => {
  try {
    return await getBestPosition()
  } catch {
    return undefined // the server refuses when the office needs a location
  }
}

/**
 * Scan the office QR, then confirm in a small pop-out: Clock in when not clocked in, Clock out
 * when clocked in (ClockConfirmSheet offers only the one that fits). Clock in continues to the
 * selfie when the supervisor requires it; clock out asks for the Task Description first.
 */
export default function ScanAttendancePage() {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [token, setToken] = useState<string | null>(null)
  // After the pop-out: which step is showing.
  const [step, setStep] = useState<'scan' | 'confirm' | 'selfie' | 'task' | 'done'>('scan')
  const [selfieRequired, setSelfieRequired] = useState(true)
  const [openLog, setOpenLog] = useState<TimeLog | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-current'] })
    queryClient.invalidateQueries({ queryKey: ['my-logs'] })
  }
  const failed = (err: { message?: string }, fallback: string) => {
    setResult({ type: 'error', text: err.message ?? fallback })
    setStep('done')
  }

  const timeIn = useMutation({
    mutationFn: async (photo?: Blob) => attendanceApi.timeInGeofence(token!, await coordsOrNothing(), photo),
    onSuccess: (res) => {
      const premises = res.data.location_flagged
        ? ' Your location couldn’t be fully verified (weak GPS).'
        : ' You’re inside the office premises.'
      setResult({ type: 'success', text: `Clocked in at ${formatDateTime(res.data.time_in)}.${premises}` })
      setStep('done')
      refresh()
    },
    onError: (err: { message?: string }) => { failed(err, 'Clock-in failed. Try again.'); refresh() },
  })

  const timeOut = useMutation({
    mutationFn: async (log: TimeLog) => attendanceApi.timeOut(log.id, token!, await coordsOrNothing()),
    onSuccess: (res) => {
      setResult({ type: 'success', text: `Clocked out at ${formatDateTime(res.data.time_out!)}. Your hours are waiting for your supervisor’s verification.` })
      setStep('done')
      refresh()
    },
    onError: (err: { message?: string }) => { failed(err, 'Clock-out failed. Try again.'); refresh() },
  })

  function handleScan(text: string) {
    if (step !== 'scan') return
    setResult(null)
    setToken(qrTokenFrom(text))
    setStep('confirm')
  }

  function choose(choice: ClockChoice) {
    if (choice.action === 'in') {
      setSelfieRequired(choice.selfieRequired)
      if (choice.selfieRequired) setStep('selfie')
      else { setStep('done'); timeIn.mutate(undefined) }
      return
    }
    setOpenLog(choice.log)
    // The Task Description is required before clocking out.
    if (choice.log.has_narrative) { setStep('done'); timeOut.mutate(choice.log) }
    else setStep('task')
  }

  const scanAgain = () => { setResult(null); setToken(null); setOpenLog(null); setStep('scan') }
  const busy = timeIn.isPending || timeOut.isPending

  return (
    <div className="space-y-6">
      <BackLink href="/recipient/attendance" label="Back to Hours & attendance" />
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Scan the office QR</h1>
        <p className="mt-1 text-sm text-ink-500">
          Point the camera at your office&apos;s QR code. You&apos;ll confirm whether you&apos;re clocking in or out.
        </p>
      </div>

      {result && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${result.type === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
          {result.type === 'success' ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
          {result.text}
        </div>
      )}

      {step === 'scan' && (
        <div className="rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
          <QrScanner onScan={handleScan} onError={(e) => setResult({ type: 'error', text: e })} />
        </div>
      )}

      {step === 'selfie' && (
        <div className="rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
          <SelfieCapture
            onCapture={(blob) => timeIn.mutate(blob)}
            onSkip={() => timeIn.mutate(undefined)}
            busy={timeIn.isPending}
            required={selfieRequired}
          />
        </div>
      )}

      {step === 'done' && (
        <div className="text-center">
          {busy ? (
            <p className="text-sm text-ink-500">Recording…</p>
          ) : (
            <button onClick={scanAgain} className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
              Scan Again
            </button>
          )}
        </div>
      )}

      {step === 'confirm' && <ClockConfirmSheet onChoose={choose} onCancel={scanAgain} />}

      {step === 'task' && openLog && (
        <NarrativeModal
          logId={openLog.id}
          clockingOut={timeOut.isPending}
          onClose={scanAgain}
          onSubmitted={() => { setStep('done'); timeOut.mutate({ ...openLog, has_narrative: true }) }}
        />
      )}
    </div>
  )
}
