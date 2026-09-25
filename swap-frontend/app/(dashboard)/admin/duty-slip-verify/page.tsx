'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck, ShieldX, Search, User, Clock, CalendarRange } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'

export default function DutySlipVerifyPage() {
  const [controlNo, setControlNo] = useState('')

  const verify = useMutation({
    mutationFn: (cn: string) => adminApi.verifyDutySlip(cn.trim()),
  })
  const result = verify.data

  const submit = () => {
    if (controlNo.trim()) verify.mutate(controlNo)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Duty Slip Authenticity</p>
        <h1 className="mt-1 font-serif text-3xl font-medium text-ink-950">Verify Control No.</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Paste the Control No. printed on a submitted duty slip to confirm it&apos;s genuine and check the
          hours the system has on record against the printed total.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <label className="mb-1.5 block text-sm font-semibold text-ink-600">Control No.</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={controlNo}
            onChange={(e) => setControlNo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="SWAP-T25R005-2425S2-SEM-ZNG6KY"
            className="h-11 flex-1 rounded-xl border border-ink-200 bg-ink-50 px-3.5 font-mono text-sm text-ink-900 placeholder:text-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/10"
          />
          <button
            onClick={submit}
            disabled={verify.isPending || !controlNo.trim()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Search className="h-4 w-4" /> {verify.isPending ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {verify.isError && (
          <p className="mt-3 text-sm text-danger-700">Could not verify right now. Please try again.</p>
        )}

        {result && (
          <div className="mt-5 space-y-4">
            {/* Verdict */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={result.valid ? { background: '#EFF8F4', border: '1px solid #B4E1CF' } : { background: '#FEF3F2', border: '1px solid #FBCBC6' }}
            >
              {result.valid ? (
                <ShieldCheck className="h-6 w-6 flex-none text-success-800" />
              ) : (
                <ShieldX className="h-6 w-6 flex-none text-danger-700" />
              )}
              <div>
                <p className="text-sm font-bold" style={{ color: result.valid ? '#145643' : '#B42318' }}>
                  {result.valid ? 'Authentic control number' : 'Invalid control number'}
                </p>
                <p className="text-xs" style={{ color: result.valid ? '#196B53' : '#B42318' }}>
                  {result.valid
                    ? 'The checksum is genuine — this code was produced by the SWAP system.'
                    : result.reason ?? 'The checksum does not match — this slip may be tampered with or mistyped.'}
                </p>
              </div>
            </div>

            {/* Details (shown whenever the code parsed) */}
            {!result.reason && (
              <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-2">
                <Detail icon={User} label="Recipient" value={result.recipient_found ? (result.recipient_name ?? '—') : 'No recipient found with this ID'} warn={!result.recipient_found} />
                <Detail icon={User} label="Student ID" value={result.student_id ?? '—'} />
                <Detail icon={CalendarRange} label="Period" value={`${fmtSem(result.semester)} · AY ${fmtAy(result.academic_year)}`} />
                <Detail icon={CalendarRange} label="Coverage" value={result.range ?? '—'} />
                <Detail
                  icon={Clock}
                  label="Hours on record for this range"
                  value={result.recorded_hours != null ? `${result.recorded_hours.toFixed(2)} hrs` : '—'}
                  strong
                  full
                />
              </dl>
            )}

            {!result.reason && (
              <p className="rounded-lg bg-warning-50 px-4 py-3 text-xs text-warning-800">
                <span className="font-semibold">Compare:</span> the “Hours on record” above should match the
                <span className="font-semibold"> Total number of hours</span> printed on the slip. If they differ,
                the printed total was altered.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function fmtSem(s?: string) {
  return s === 'S1' ? '1st Semester' : s === 'S2' ? '2nd Semester' : s === 'SM' ? 'Summer' : (s ?? '—')
}
// Mirrors DutySlipControl::academicYear — "0000"/"YY00" means the slip had no term.
function fmtAy(ay?: string) {
  if (!ay || !/^\d{4}$/.test(ay)) return ay ?? '—'
  if (ay.slice(2) === '00') return 'unknown'
  return `20${ay.slice(0, 2)}-20${ay.slice(2)}`
}

function Detail({ icon: Icon, label, value, strong, warn, full }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  strong?: boolean
  warn?: boolean
  full?: boolean
}) {
  return (
    <div className={`bg-white px-4 py-3 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-0.5 ${strong ? 'text-lg font-bold' : 'text-sm font-medium'} ${warn ? 'text-danger-700' : 'text-ink-950'}`}>
        {value}
      </p>
    </div>
  )
}
