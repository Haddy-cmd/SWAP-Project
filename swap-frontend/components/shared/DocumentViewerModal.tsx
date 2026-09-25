'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, ExternalLink, Download, FileText, ZoomIn, ZoomOut, RotateCw, RotateCcw,
  Maximize, ChevronLeft, ChevronRight,
} from 'lucide-react'

export interface ViewableDocument {
  file_url: string
  file_name?: string | null
  mime_type?: string | null
  document_type?: string | null
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const ZOOM_STEP = 0.25

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
const isImage = (doc: ViewableDocument) => (doc.mime_type ?? '').startsWith('image/')
const titleOf = (doc: ViewableDocument) =>
  (doc.document_type ?? doc.file_name ?? 'Document').replace(/_/g, ' ')

/**
 * Lightbox-style document preview. Images open in a zoomable, pannable and
 * rotatable viewer — reviewers often have to read small print on a phone photo
 * of a document, and phone photos frequently arrive sideways. PDFs and anything
 * else keep the previous behaviour.
 *
 * Zoom/pan/rotate is implemented directly rather than via a library: rotation
 * and the toolbar's zoom readout would need custom wiring around one anyway,
 * and this keeps the dependency list unchanged.
 *
 * Pass `docs` to page through several files with Previous/Next.
 */
export function DocumentViewerModal({ doc, docs, onClose }: {
  doc: ViewableDocument
  /** Optional sibling documents; enables Previous/Next inside the viewer. */
  docs?: ViewableDocument[]
  onClose: () => void
}) {
  // Only images take part in prev/next — paging onto a PDF mid-zoom is jarring.
  const gallery = (docs ?? []).filter(isImage)
  const startIndex = Math.max(0, gallery.findIndex((d) => d.file_url === doc.file_url))
  const [index, setIndex] = useState(startIndex)

  const current = isImage(doc) && gallery.length > 1 ? (gallery[index] ?? doc) : doc
  const showsGallery = isImage(doc) && gallery.length > 1

  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const image = isImage(current)
  const pdf = current.mime_type === 'application/pdf'
  const title = titleOf(current)

  const reset = useCallback(() => {
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }, [])

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => {
      const next = clampZoom(z + delta)
      // Recentre when returning to 1x or below, so the image can't be lost off-screen.
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  const step = useCallback((direction: 1 | -1) => {
    if (!showsGallery) return
    setIndex((i) => (i + direction + gallery.length) % gallery.length)
    reset() // a new image starts unzoomed and unrotated
  }, [showsGallery, gallery.length, reset])

  // Escape closes; arrow keys page through a gallery; +/- zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (!image) return
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
      else if (e.key === '-') zoomBy(-ZOOM_STEP)
      else if (e.key === '0') reset()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, image, step, zoomBy, reset])

  // Wheel zoom. Registered natively (not via onWheel) so it can be non-passive
  // and preventDefault the page scroll behind the modal.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !image) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [image, zoomBy])

  // ---- Panning (mouse) ----
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current
    if (!drag) return
    setOffset({ x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) })
  }

  const endDrag = () => { dragRef.current = null }

  // ---- Panning + pinch (touch) ----
  const touchDistance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(e.touches), zoom }
      dragRef.current = null
    } else if (e.touches.length === 1 && zoom > 1) {
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const pinch = pinchRef.current
    if (pinch && e.touches.length === 2) {
      e.preventDefault()
      const ratio = touchDistance(e.touches) / (pinch.distance || 1)
      const next = clampZoom(pinch.zoom * ratio)
      setZoom(next)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return
    }

    const drag = dragRef.current
    if (drag && e.touches.length === 1) {
      e.preventDefault()
      setOffset({ x: drag.ox + (e.touches[0].clientX - drag.x), y: drag.oy + (e.touches[0].clientY - drag.y) })
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) dragRef.current = null
  }

  const toolBtn =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-brand-700 hover:bg-ink-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize text-ink-950">{title}</p>
            <p className="truncate text-xs text-ink-400">
              {current.file_name}
              {showsGallery && <span className="ml-2">· {index + 1} of {gallery.length}</span>}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            {image && (
              <>
                <button onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}
                  title="Zoom out" aria-label="Zoom out" className={toolBtn}>
                  <ZoomOut className="h-4 w-4" />
                </button>

                <span className="w-14 text-center text-xs font-semibold tabular-nums text-ink-500">
                  {Math.round(zoom * 100)}%
                </span>

                <button onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}
                  title="Zoom in" aria-label="Zoom in" className={toolBtn}>
                  <ZoomIn className="h-4 w-4" />
                </button>

                <button onClick={() => setRotation((r) => r - 90)} title="Rotate left" aria-label="Rotate left" className={toolBtn}>
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button onClick={() => setRotation((r) => r + 90)} title="Rotate right" aria-label="Rotate right" className={toolBtn}>
                  <RotateCw className="h-4 w-4" />
                </button>

                <button onClick={reset} title="Reset zoom and rotation" aria-label="Reset view" className={toolBtn}>
                  <Maximize className="h-4 w-4" />
                </button>

                <span className="mx-1 h-6 w-px bg-ink-200" />
              </>
            )}

            <a href={current.file_url} target="_blank" rel="noopener noreferrer"
              title="Open in new tab" className={toolBtn}>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a href={current.file_url} download={current.file_name ?? true} title="Download" className={toolBtn}>
              <Download className="h-4 w-4" />
            </a>
            <button onClick={onClose} title="Close" aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-brand-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={stageRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink-100"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: image ? 'none' : 'auto', cursor: image && zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default' }}
        >
          {image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // The original upload, never a thumbnail, so zooming stays sharp.
                src={current.file_url}
                alt={title}
                draggable={false}
                className="max-h-[78vh] max-w-full select-none object-contain"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: dragRef.current || pinchRef.current ? 'none' : 'transform 120ms ease-out',
                }}
              />

              {showsGallery && (
                <>
                  <button onClick={() => step(-1)} title="Previous image" aria-label="Previous image"
                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => step(1)} title="Next image" aria-label="Next image"
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </>
          ) : pdf ? (
            <iframe src={current.file_url} title={title} className="h-[80vh] w-full border-0" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="h-12 w-12 text-ink-300" />
              <p className="text-sm text-ink-500">This file type can&apos;t be previewed here.</p>
              <a
                href={current.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Open in new tab
              </a>
            </div>
          )}
        </div>

        {image && (
          <div className="border-t border-ink-200 px-5 py-2 text-center text-[11px] text-ink-400">
            Scroll or pinch to zoom · drag to pan when zoomed{showsGallery ? ' · arrow keys to change image' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
