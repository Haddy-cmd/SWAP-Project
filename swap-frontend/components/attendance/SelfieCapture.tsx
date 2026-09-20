'use client'

import { useState } from 'react'
import { Camera, RotateCcw, Check, Loader2, CameraOff, SwitchCamera } from 'lucide-react'
import { useCameraStream } from '@/lib/hooks/useCameraStream'

/**
 * Proof-of-presence selfie for clock-in. Opens the front camera by default,
 * lets the recipient flip to the back camera, snap a photo, and hands back a
 * JPEG Blob. When the camera is blocked the caller decides what happens next:
 * a supervisor who requires a selfie gets no "continue anyway" escape hatch.
 */
export function SelfieCapture({ onCapture, onSkip, busy, required = false }: {
  onCapture: (blob: Blob) => void
  onSkip: () => void
  busy?: boolean
  /** When true the selfie cannot be skipped — the backend will reject the clock-in. */
  required?: boolean
}) {
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  // Freeze the camera while a preview is showing; restart it on retake.
  const { videoRef, facing, flip, stop, ready, hasMultipleCameras, errorMessage } =
    useCameraStream('user', !preview)

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
        {errorMessage && !preview ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#D9BBAF]">
            <CameraOff className="h-8 w-8" />
            <span className="text-xs">{errorMessage}</span>
          </div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Your selfie" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              // Mirror the front camera only — a mirrored back camera looks wrong.
              className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1E1512]">
                <Loader2 className="h-6 w-6 animate-spin text-[#D9BBAF]" />
              </div>
            )}
            {hasMultipleCameras && ready && (
              <button
                type="button"
                onClick={flip}
                title="Flip camera"
                aria-label="Flip camera"
                className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {preview ? (
          <>
            <button onClick={() => { stop(); onCapture(preview.blob) }} disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Use photo &amp; clock in
            </button>
            <button onClick={retake} disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#EAD9D9] text-sm font-semibold text-[#7D1A1A] disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
          </>
        ) : errorMessage ? (
          required ? (
            <p className="rounded-xl bg-[#FEF0F0] px-4 py-3 text-xs font-medium text-[#B23B3B]">
              Your supervisor requires a selfie to clock in, so this step can&apos;t be skipped. Fix camera
              access above, then take your photo.
            </p>
          ) : (
            <button onClick={() => { stop(); onSkip() }} disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue without photo
            </button>
          )
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
