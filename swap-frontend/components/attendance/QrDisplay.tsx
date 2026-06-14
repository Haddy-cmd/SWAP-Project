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
      <div className="rounded-xl border-2 border-[#1B4F72] p-4 bg-white shadow-md">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor="#ffffff"
          fgColor="#1B4F72"
          level="H"
          includeMargin
        />
      </div>
      {caption && (
        <p className="text-center text-xs text-[#64748B] font-mono">{caption}</p>
      )}
    </div>
  )
}
