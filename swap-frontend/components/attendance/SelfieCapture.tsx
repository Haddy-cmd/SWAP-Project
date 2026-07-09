'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, Check, Loader2, CameraOff } from 'lucide-react'

/**
 * Proof-of-presence selfie for clock-in. Opens the front camera, lets the
 * recipient snap a photo, and hands back a JPEG Blob. Falls back gracefully if
 * the camera is blocked (the caller can still clock in without a photo).
 */
export function SelfieCapture({ onCapture, onSkip, busy }: {
  onCapture: (blob: Blob) => void
  onSkip: () => void
  busy?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch {
        setError('Camera unavailable — allow camera access, or continue without a photo.')
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const stopCamera = () => streamRef.current?.getTracks().forEach((t) => t.stop())

  const snap = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 640
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) setPreview({ url: URL.createObjectURL(blob), blob })
    }, 'image/jpeg', 0.85)
  }

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF0F0]">
        <Camera className="h-6 w-6 text-[#7D1A1A]" />
      </div>
      <h1 className="text-lg font-bold text-[#1E293B]">Take a quick selfie</h1>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[#8A6A6A]">
        This confirms you&apos;re really at your office. Your supervisor will see it with your attendance.
      </p>

      <div className="relative mx-auto mt-5 aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-2xl bg-[#1E1512]">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#D9BBAF]">
            <CameraOff className="h-8 w-8" />
            <span className="text-xs">{error}</span>
          </div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Your selfie" className="h-full w-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1E1512]">
                <Loader2 className="h-6 w-6 animate-spin text-[#D9BBAF]" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {preview ? (
          <>
            <button onClick={() => { stopCamera(); onCapture(preview.blob) }} disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Use photo & clock in
            </button>
            <button onClick={retake} disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#EAD9D9] text-sm font-semibold text-[#7D1A1A] disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
          </>
        ) : error ? (
          <button onClick={() => { stopCamera(); onSkip() }} disabled={busy}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue without photo
          </button>
        ) : (
          <button onClick={snap} disabled={!ready || busy}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-white disabled:opacity-50">
            <Camera className="h-5 w-5" /> Capture
          </button>
        )}
      </div>
    </div>
  )
}
