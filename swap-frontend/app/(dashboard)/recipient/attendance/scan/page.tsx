'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { QrScanner } from '@/components/attendance/QrScanner'
import { SelfieCapture } from '@/components/attendance/SelfieCapture'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getBestPosition } from '@/lib/utils/geolocation'

export default function ScanAttendancePage() {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [scanned, setScanned] = useState(false)
  // After a QR scan we hold the token and ask for a selfie before clocking in.
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  // The recipient's supervisor decides whether the selfie step happens at all.
  // Default to requiring it until we know, so the step is never skipped by a
  // slow response. The backend enforces the same rule regardless.
  const { data: assignment } = useQuery({
    queryKey: ['recipient-assignment'],
    queryFn: () => attendanceApi.getMyAssignment(),
  })
  const selfieRequired = assignment?.selfie_required ?? true

  const timeIn = useMutation({
    mutationFn: async ({ token, photo }: { token: string; photo?: Blob }) => {
      let coords
      try {
        coords = await getBestPosition()
      } catch {
        coords = undefined
      }
      return attendanceApi.timeInGeofence(token, coords, photo)
    },
    onSuccess: (res) => {
      const premises = res.data.location_flagged
        ? ' Your location couldn’t be fully verified (weak GPS).'
        : ' You’re inside the office premises.'
      setResult({
        type: 'success',
        text: `Time-in recorded at ${formatDateTime(res.data.time_in)}.${premises}`,
      })
      setPendingToken(null)
      setScanned(true)
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
    },
    onError: (err: { message?: string }) => {
      setResult({ type: 'error', text: err.message ?? 'Time-in failed. Try again.' })
      setPendingToken(null)
      setScanned(true)
    },
  })

  function handleScan(token: string) {
    if (scanned || pendingToken || timeIn.isPending) return

    // Selfie turned off for this office: clock straight in, no camera step.
    if (!selfieRequired) {
      timeIn.mutate({ token })
      return
    }

    setPendingToken(token)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Scan QR Code</h1>
        <p className="mt-1 text-sm text-ink-500">
          Point the camera at your assigned office QR code to clock in.
        </p>
      </div>

      {result && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            result.type === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
          }`}
        >
          {result.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          {result.text}
        </div>
      )}

      {pendingToken ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <SelfieCapture
            onCapture={(blob) => timeIn.mutate({ token: pendingToken, photo: blob })}
            onSkip={() => timeIn.mutate({ token: pendingToken })}
            busy={timeIn.isPending}
            required={selfieRequired}
          />
        </div>
      ) : !scanned ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <QrScanner onScan={handleScan} onError={(e) => setResult({ type: 'error', text: e })} />
        </div>
      ) : (
        <div className="text-center">
          <button
            onClick={() => { setScanned(false); setResult(null) }}
            className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  )
}
