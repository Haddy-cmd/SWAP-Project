'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOff, SwitchCamera } from 'lucide-react'
import type { Facing } from '@/lib/hooks/useCameraStream'

interface QrScannerProps {
  onScan: (token: string) => void
  onError?: (error: string) => void
}

/** Friendly wording for the ways a camera can refuse to start. */
function cameraMessage(raw: string): string {
  if (/permission|denied|notallowed/i.test(raw)) {
    return 'Camera access was blocked. Allow the camera in your browser settings, then try again.'
  }
  if (/secure context|https/i.test(raw)) {
    return 'The camera needs a secure connection (https). Open this page over https and try again.'
  }
  if (/notfound|no.*camera/i.test(raw)) {
    return 'No camera was found on this device.'
  }
  if (/notreadable|in use|busy/i.test(raw)) {
    return 'The camera is already in use by another app. Close it and try again.'
  }
  return 'The camera could not be started. Try again, or paste the QR token on the Attendance page.'
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  // Hold the latest callbacks so the start/stop effect can run ONCE per facing
  // mode (stable identity), instead of tearing down the camera every render.
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  // QR scanning wants the back camera; the selfie step defaults to the front.
  const [facing, setFacing] = useState<Facing>('environment')
  const [started, setStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  // Only offer the flip button when the device actually has a second camera.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    let cancelled = false

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!cancelled) setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch(() => { /* device list is a nice-to-have */ })

    return () => { cancelled = true }
  }, [started])

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    // Only stop when the scanner is actually running — stop() throws synchronously
    // otherwise. stop() also releases the underlying tracks, which is what lets
    // the other camera open cleanly when flipping.
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

    setCameraError(null)

    scanner
      .start(
        { facingMode: facing },
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
          setCameraError(cameraMessage(msg))
        } else {
          onErrorRef.current?.(msg)
        }
      })

    return () => {
      cancelled = true
      void stop()
    }
  }, [facing])

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#EAD9D9] bg-[#FAF7F7] p-8 text-center">
        <CameraOff className="h-10 w-10 text-[#E74C3C]" />
        <p className="text-sm font-medium text-[#1E293B]">Camera unavailable</p>
        <p className="text-xs text-[#8A6A6A]">{cameraError}</p>
        {hasMultipleCameras && (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[#EAD9D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#7D1A1A] hover:bg-[#FBF7F2] transition-colors"
          >
            <SwitchCamera className="h-4 w-4" /> Try the other camera
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm">
        <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-[#7D1A1A]" />
        {hasMultipleCameras && started && (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            title="Flip camera"
            aria-label="Flip camera"
            className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        )}
      </div>
      {started && <p className="text-xs text-[#8A6A6A]">Point the camera at the QR code</p>}
    </div>
  )
}
