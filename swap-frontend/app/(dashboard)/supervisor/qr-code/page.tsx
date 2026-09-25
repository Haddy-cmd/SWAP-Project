'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QrCode, MapPin, Printer, Copy, Check, AlertCircle, Camera } from 'lucide-react'
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
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <div className="flex items-center gap-2">
        <input readOnly value={value} className="min-w-0 flex-1 truncate rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 text-xs text-ink-700" />
        <button onClick={copy} className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-ink-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

/**
 * Per-supervisor switch for the clock-in selfie. Turning it off only affects
 * future clock-ins — attendance already recorded keeps the photo it was saved
 * with. The backend enforces the same rule, so this is a convenience, not the
 * security boundary.
 */
function SelfieSettingCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-settings'],
    queryFn: () => supervisorApi.getSettings(),
  })

  const [notice, setNotice] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (value: boolean) => supervisorApi.updateSettings({ require_clock_in_selfie: value }),
    onSuccess: (res) => {
      setNotice(res.message)
      queryClient.invalidateQueries({ queryKey: ['supervisor-settings'] })
    },
  })

  const enabled = data?.require_clock_in_selfie ?? true

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm print:hidden">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Camera className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">Require selfie on clock-in</p>
          <p className="mt-1 text-sm text-ink-500">
            When on, your students must take a photo before they can clock in. When off, they clock in
            straight after scanning. Past attendance and its photos are not affected.
          </p>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={isLoading || save.isPending}
            onClick={() => { setNotice(null); save.mutate(!enabled) }}
            className={`mt-3 inline-flex h-7 w-12 flex-none items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? 'bg-brand-700' : 'bg-ink-300'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="ml-2 align-middle text-sm font-medium text-ink-700">
            {isLoading ? 'Loading\u2026' : enabled ? 'On' : 'Off'}
          </span>

          {notice && <p className="mt-2 text-xs font-medium text-success-600">{notice}</p>}
        </div>
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
        <h1 className="text-2xl font-bold text-ink-900">Office QR Code</h1>
        <p className="mt-1 text-sm text-ink-500">
          Display or print this code at your office. Recipients scan it to clock in and out.
        </p>
      </div>

      <SelfieSettingCard />

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-2xl bg-ink-200/50" />
      ) : noOffice || (error && !data) ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600" />
          <div>
            <p className="font-semibold text-warning-800">No office assigned</p>
            <p className="mt-1 text-sm text-warning-700">
              You aren&apos;t assigned to an office yet, so there&apos;s no QR code to show. Please contact the DSA office.
            </p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Printable QR card */}
          <div className="rounded-2xl border border-ink-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <QrCode className="h-6 w-6" />
              </span>
              <h2 className="mt-3 text-xl font-bold text-ink-900">{data.office.name}</h2>
              {data.office.location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                  <MapPin className="h-3.5 w-3.5" /> {data.office.location}
                </p>
              )}

              <div className="my-6">
                <QrDisplay value={scanUrl} size={240} caption={`SWAP Attendance · ${data.office.name}`} />
              </div>

              <p className="max-w-sm text-sm text-ink-500">
                Recipients open their phone camera, scan this code, and confirm their location to record attendance.
              </p>
            </div>
          </div>

          {/* Actions + manual fallbacks (hidden when printing) */}
          <div className="space-y-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Printer className="h-4 w-4" /> Print QR Code
            </button>

            <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-350">Manual fallback</p>
              <CopyField label="Scan link — open in a phone browser" value={scanUrl} />
              <CopyField label="QR token — paste in Attendance → QR Token" value={data.qr_code} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
