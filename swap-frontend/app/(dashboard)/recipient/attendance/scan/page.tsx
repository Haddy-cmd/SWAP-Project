'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { QrScanner } from '@/components/attendance/QrScanner'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { getCurrentPosition } from '@/lib/utils/geolocation'

export default function ScanAttendancePage() {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [scanned, setScanned] = useState(false)

  const timeIn = useMutation({
    mutationFn: async (token: string) => {
      let coords
      try {
        coords = await getCurrentPosition()
      } catch {
        coords = undefined
      }
      return attendanceApi.timeInGeofence(token, coords)
    },
    onSuccess: (res) => {
      setResult({
        type: 'success',
        text: `Time-in recorded at ${formatDateTime(res.data.time_in)}`,
      })
      setScanned(true)
      queryClient.invalidateQueries({ queryKey: ['hours-summary'] })
    },
    onError: (err: { message?: string }) => {
      setResult({ type: 'error', text: err.message ?? 'Time-in failed. Try again.' })
      setScanned(true)
    },
  })

  function handleScan(token: string) {
    if (!scanned) timeIn.mutate(token)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Scan QR Code</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Point the camera at your assigned office QR code to clock in.
        </p>
      </div>

      {result && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            result.type === 'success' ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
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

      {!scanned ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <QrScanner onScan={handleScan} onError={(e) => setResult({ type: 'error', text: e })} />
        </div>
      ) : (
        <div className="text-center">
          <button
            onClick={() => { setScanned(false); setResult(null) }}
            className="rounded-xl bg-[#1B4F72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  )
}
