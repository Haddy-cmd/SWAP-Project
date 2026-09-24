'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser, Save, Upload } from 'lucide-react'

const W = 480
const H = 180

/**
 * Draw-a-signature pad with an upload fallback. Ink is dark on transparency so
 * the PNG sits naturally on the white claim stub. Pointer events cover mouse,
 * pen, and touch (touch-action:none keeps page scroll from hijacking strokes).
 */
export function SignaturePad({
  onSave,
  busy,
}: {
  onSave: (file: File) => void
  busy: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)

  // Scale the backing store for crisp strokes on high-DPI screens.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
  }, [])

  function pos(e: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [(e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height)]
  }

  function down(e: React.PointerEvent) {
    drawing.current = true
    canvasRef.current!.setPointerCapture(e.pointerId)
    const [x, y] = pos(e)
    canvasRef.current!.getContext('2d')!.beginPath()
    canvasRef.current!.getContext('2d')!.moveTo(x, y)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const [x, y] = pos(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.lineTo(x, y)
    ctx.stroke()
    setEmpty(false)
  }

  function up() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, W, H)
    setEmpty(true)
  }

  function save() {
    canvasRef.current!.toBlob((blob) => {
      if (blob) onSave(new File([blob], 'signature.png', { type: 'image/png' }))
    }, 'image/png')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onSave(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 140, touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={clear} disabled={busy || empty}
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
        <button type="button" onClick={save} disabled={busy || empty}
          className="flex items-center gap-1.5 rounded-lg bg-[#1B4F72] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2980B9] disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : 'Save signature'}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1B4F72] hover:bg-[#F8FAFC] disabled:opacity-50">
          <Upload className="h-3.5 w-3.5" /> Upload instead
        </button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      </div>
    </div>
  )
}
