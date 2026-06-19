'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOff } from 'lucide-react'

interface QrScannerProps {
  onScan: (token: string) => void
  onError?: (error: string) => void
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  // Hold the latest callbacks so the start/stop effect can run ONCE (stable identity),
  // instead of tearing down the camera every render when the parent passes new functions.
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  const [started, setStarted] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    // Only stop when the scanner is actually running — stop() throws synchronously otherwise.
    const stop = async () => {
      try {
        const state = scanner.getState()
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scanner.stop()
        }
        scanner.clear()
      } catch {
        /* scanner was never running — nothing to stop */
      }
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScanRef.current(decodedText)
          void stop()
          setStarted(false)
        },
        () => undefined, // per-frame decode failures: ignore
      )
      .then(() => { if (!cancelled) setStarted(true) })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        // Permission denied / no camera / camera busy → show the friendly card.
        if (/permission|denied|notallowed|notfound|notreadable|no.*camera|secure context/i.test(msg)) {
          setCameraError(true)
        } else {
          onErrorRef.current?.(msg)
        }
      })

    return () => {
      cancelled = true
      void stop()
    }
  }, [])

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#EAD9D9] bg-[#FAF7F7] p-8 text-center">
        <CameraOff className="h-10 w-10 text-[#E74C3C]" />
        <p className="text-sm font-medium text-[#1E293B]">Camera unavailable</p>
        <p className="text-xs text-[#8A6A6A]">
          Allow camera access (and use a phone with a working camera over HTTPS), or paste the QR
          token manually on the Attendance page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-reader"
        className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-[#7D1A1A]"
      />
      {started && <p className="text-xs text-[#8A6A6A]">Point the camera at the QR code</p>}
    </div>
  )
}
