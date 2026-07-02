'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

const BOX = 288 // on-screen crop circle diameter
const OUT = 512 // exported image size (square)

/**
 * Minimal square/circle avatar cropper — drag to reposition, slide to zoom.
 * Exports a cropped JPEG Blob. No external dependency.
 */
export function AvatarCropper({ file, onCancel, onCropped, busy }: {
  file: File
  onCancel: () => void
  onCropped: (blob: Blob) => void
  busy?: boolean
}) {
  const [url, setUrl] = useState('')
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const baseCover = nat.w && nat.h ? BOX / Math.min(nat.w, nat.h) : 1
  const scale = baseCover * zoom
  const dispW = nat.w * scale
  const dispH = nat.h * scale

  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(BOX - dispW, o.x)),
    y: Math.min(0, Math.max(BOX - dispH, o.y)),
  })

  // Re-clamp / recenter when the image or zoom changes.
  useEffect(() => {
    if (!nat.w) return
    setOffset((o) => clamp({ x: o.x, y: o.y }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, nat])

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNat({ w: img.naturalWidth, h: img.naturalHeight })
    const bc = BOX / Math.min(img.naturalWidth, img.naturalHeight)
    setOffset({ x: (BOX - img.naturalWidth * bc) / 2, y: (BOX - img.naturalHeight * bc) / 2 })
  }

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }))
  }
  const onUp = () => { drag.current = null }

  const save = () => {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const srcSize = BOX / scale
    ctx.drawImage(img, -offset.x / scale, -offset.y / scale, srcSize, srcSize, 0, 0, OUT, OUT)
    canvas.toBlob((blob) => blob && onCropped(blob), 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-serif text-lg font-semibold text-[#241715]">Adjust your photo</h3>

        <div
          className="relative mx-auto overflow-hidden rounded-full bg-[#F1ECE4]"
          style={{ width: BOX, height: BOX, touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{ width: dispW, height: dispH, left: offset.x, top: offset.y, maxWidth: 'none' }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-xs font-medium text-[#8A7A73]">Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#7C1B26]" />
        </div>
        <p className="mt-1.5 text-center text-xs text-[#A38A82]">Drag to reposition · slide to zoom</p>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-xl border border-[#EADFD4] px-5 py-2.5 text-sm font-semibold text-[#7A6A63] hover:bg-[#FBF7F2] transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#7C1B26] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#86202E] disabled:opacity-60 transition-colors">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
