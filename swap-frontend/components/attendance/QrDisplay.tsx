'use client'

import { QRCodeSVG } from 'qrcode.react'

interface QrDisplayProps {
  value: string
  size?: number
  caption?: string
}

export function QrDisplay({ value, size = 200, caption }: QrDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border-2 border-brand-700 p-4 bg-white shadow-md">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor="#ffffff"
          fgColor="#0B2716"
          level="H"
          includeMargin
        />
      </div>
      {caption && (
        <p className="text-center text-xs text-ink-500 font-mono">{caption}</p>
      )}
    </div>
  )
}
