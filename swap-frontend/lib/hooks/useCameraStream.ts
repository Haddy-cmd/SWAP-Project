'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type Facing = 'user' | 'environment'

/** A camera error the UI can explain, rather than a blank black box. */
export type CameraErrorKind = 'denied' | 'unavailable' | 'insecure' | 'unknown'

const MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Camera access was blocked. Allow the camera in your browser settings, then try again.',
  unavailable: 'No camera was found, or another app is already using it. Close other camera apps and try again.',
  insecure: 'The camera needs a secure connection (https). Open this page over https and try again.',
  unknown: 'The camera could not be started. Try again, or reload the page.',
}

function classify(err: unknown): CameraErrorKind {
  const name = (err as { name?: string })?.name ?? ''
  const message = err instanceof Error ? err.message : String(err)

  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission|denied|notallowed/i.test(message)) return 'denied'
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'unavailable'
  if (/secure context|https/i.test(message)) return 'insecure'
  if (/no.*camera|notfound|notreadable/i.test(message)) return 'unavailable'
  return 'unknown'
}

/**
 * Owns a getUserMedia stream and the front/back switch.
 *
 * Every start stops the previous stream's tracks first. Mobile Safari in
 * particular will hand back a frozen frame (or refuse outright) if two streams
 * are open at once, so releasing before acquiring is what makes flipping work
 * on a phone rather than locking the camera.
 */
export function useCameraStream(initialFacing: Facing, active = true) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<Facing>(initialFacing)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<CameraErrorKind | null>(null)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  /** Release the current stream. Safe to call when nothing is running. */
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Only offer the flip button when there is actually somewhere to flip to.
  // Labels stay empty until permission is granted, so this is re-run after the
  // stream starts, when the device list becomes meaningful.
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    let cancelled = false

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch(() => { /* device list is a nice-to-have */ })

    return () => { cancelled = true }
  }, [active, ready])

  // Start (or restart) the stream whenever the facing mode changes.
  useEffect(() => {
    if (!active) { stop(); setReady(false); return }

    let cancelled = false

    ;(async () => {
      setReady(false)
      setError(null)

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext === false ? 'insecure' : 'unavailable')
        return
      }

      // Release first: holding two streams is what freezes the picture on iOS.
      stop()

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `ideal` rather than `exact` so a device with only one camera still
          // opens it instead of throwing OverconstrainedError.
          video: { facingMode: { ideal: facing } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // iOS needs these set before play() or it opens fullscreen.
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.muted = true
          await videoRef.current.play().catch(() => { /* autoplay guard */ })
        }

        setReady(true)
      } catch (err) {
        if (!cancelled) setError(classify(err))
      }
    })()

    return () => { cancelled = true; stop() }
  }, [facing, active, stop])

  const flip = useCallback(() => setFacing((f) => (f === 'user' ? 'environment' : 'user')), [])

  return {
    videoRef,
    facing,
    flip,
    stop,
    ready,
    hasMultipleCameras,
    error,
    errorMessage: error ? MESSAGES[error] : null,
  }
}
