'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CameraOff } from 'lucide-react'

interface QrScannerProps {
  onScan: (token: string) => void
  onError?: (error: string) => void
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [started, setStarted] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    const id = 'qr-reader'
    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText)
          scanner.stop().catch(() => null)
          setStarted(false)
        },
        () => null,
      )
      .then(() => setStarted(true))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('permission')) {
          setPermissionDenied(true)
        } else {
          onError?.(msg)
        }
      })

    return () => {
      scanner.stop().catch(() => null)
    }
  }, [onScan, onError])

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <CameraOff className="h-10 w-10 text-[#E74C3C]" />
        <p className="text-sm font-medium text-[#1E293B]">Camera access denied</p>
        <p className="text-xs text-[#64748B]">
          Please allow camera access in your browser settings and reload the page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-reader"
        ref={containerRef}
        className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-[#1B4F72]"
      />
      {started && (
        <p className="text-xs text-[#64748B]">Point the camera at the QR code</p>
      )}
    </div>
  )
}
