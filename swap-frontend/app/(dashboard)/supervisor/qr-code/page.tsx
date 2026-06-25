'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, MapPin, Printer, Copy, Check, AlertCircle } from 'lucide-react'
import { supervisorApi } from '@/lib/api/supervisor.api'
import { QrDisplay } from '@/components/attendance/QrDisplay'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">{label}</label>
      <div className="flex items-center gap-2">
        <input readOnly value={value} className="min-w-0 flex-1 truncate rounded-lg border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-xs text-[#475569]" />
        <button onClick={copy} className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#DCC5C5] px-3 py-2 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-[#27AE60]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function SupervisorQrPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['supervisor-office-qr'],
    queryFn: () => supervisorApi.getOfficeQr(),
    retry: false,
  })

  const scanUrl =
    data && typeof window !== 'undefined'
      ? `${window.location.origin}/scan?t=${encodeURIComponent(data.qr_code)}`
      : ''

  const noOffice = (error as { status?: number } | null)?.status === 404 ||
    (error as { response?: { status?: number } } | null)?.response?.status === 404

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Office QR Code</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">
          Display or print this code at your office. Recipients scan it to clock in and out.
        </p>
      </div>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-2xl bg-[#EAD9D9]/50" />
      ) : noOffice || (error && !data) ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#F6E0BE] bg-[#FFF7ED] p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#D97706]" />
          <div>
            <p className="font-semibold text-[#92400E]">No office assigned</p>
            <p className="mt-1 text-sm text-[#B45309]">
              You aren&apos;t assigned to an office yet, so there&apos;s no QR code to show. Please contact the DSA office.
            </p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Printable QR card */}
          <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm print:border-0 print:shadow-none">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEF0F0] text-[#7D1A1A]">
                <QrCode className="h-6 w-6" />
              </span>
              <h2 className="mt-3 text-xl font-bold text-[#1E293B]">{data.office.name}</h2>
              {data.office.location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-[#8A6A6A]">
                  <MapPin className="h-3.5 w-3.5" /> {data.office.location}
                </p>
              )}

              <div className="my-6">
                <QrDisplay value={scanUrl} size={240} caption={`SWAP Attendance · ${data.office.name}`} />
              </div>

              <p className="max-w-sm text-sm text-[#64748B]">
                Recipients open their phone camera, scan this code, and confirm their location to record attendance.
              </p>
            </div>
          </div>

          {/* Actions + manual fallbacks (hidden when printing) */}
          <div className="space-y-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
            >
              <Printer className="h-4 w-4" /> Print QR Code
            </button>

            <div className="space-y-3 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Manual fallback</p>
              <CopyField label="Scan link — open in a phone browser" value={scanUrl} />
              <CopyField label="QR token — paste in Attendance → QR Token" value={data.qr_code} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
