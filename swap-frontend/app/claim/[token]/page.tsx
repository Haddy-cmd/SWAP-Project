'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, HandCoins, KeyRound, Loader2 } from 'lucide-react'
import { claimApi } from '@/lib/api/stipend.api'
import { formatDate, formatDateTime } from '@/lib/utils/formatDate'
import type { ApiRequestError } from '@/lib/api/axios'
import type { ClaimReleaseResult } from '@/types/analytics.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

// Same wording as StipendVerifyController::MSG_INVALID and BankingOfficePin::MSG_NOT_SET.
const MSG_INVALID = 'This claim slip is invalid, already claimed, or has been voided.'
const MSG_NOT_SET = 'The Banking Office PIN has not been set up yet. Please contact the DSA Office.'

/**
 * Banking Office scan-to-confirm. The QR printed on a certified claim stub lands
 * here. Public (no login): the releasing officer checks the details against the
 * paper stub, pays out, then records it with the Banking Office PIN. The name on
 * the stub is the releasing officer the DSA set up with that PIN — nothing is typed
 * here. Recording marks the stub claimed and consumes its single-use token, so the
 * same QR can never be paid twice.
 */
export default function ClaimReleasePage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ClaimReleaseResult | null>(null)
  const { notify, confirm } = useFeedback()

  const { data: claim, isLoading, isError, error: loadError } = useQuery({
    queryKey: ['claim-verify', token],
    queryFn: () => claimApi.verify(token),
    retry: false,
    enabled: !!token,
  })

  const release = useMutation({
    mutationFn: () => claimApi.release(token, { pin }),
    onSuccess: (res) => {
      setDone(res.data); setPin(''); setError(null)
      notify({ title: 'Payout recorded', detail: `${claim?.recipient_name ?? 'The beneficiary'} · ${PHP.format(Number(claim?.amount ?? 0))}. The stub can't be used again.` })
      queryClient.invalidateQueries({ queryKey: ['claim-verify', token] })
      queryClient.invalidateQueries({ queryKey: ['stipend-history'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stipend'] })
    },
    onError: (e: ApiRequestError) => {
      setPin('')
      setError(e.errors?.pin?.[0] ?? e.message ?? 'Could not record the payout.')
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-ink-350">SWAP · University Banking Office</p>

        {isLoading && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-700" />
            <p className="mt-3 text-sm text-ink-500">Checking the claim stub…</p>
          </div>
        )}

        {isError && !done && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
              <AlertTriangle className="h-8 w-8 text-danger-600" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">Do not release</h1>
            <p className="mt-2 text-sm text-danger-600">{(loadError as Error | null)?.message || MSG_INVALID}</p>
          </div>
        )}

        {done && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-ink-900">Released</h1>
            <p className="mt-2 text-sm text-ink-500">
              Recorded{done.claimed_at ? ` at ${formatDateTime(done.claimed_at)}` : ''} by {done.releasing_officer_name}.
            </p>
            <p className="mt-1 font-mono text-xs text-ink-350">{done.control_number}</p>
            <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">This stub is now marked as claimed and cannot be paid again.</p>
          </div>
        )}

        {claim && !done && (
          <>
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <div className="flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-brand-700" />
                <span className="rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-brand-700">Ready to claim</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-brand-700">{PHP.format(Number(claim.amount))}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <Row label="Beneficiary" value={claim.recipient_name ?? '—'} />
                <Row label="Student ID" value={claim.student_id_number ?? '—'} />
                <Row label="Control No." value={claim.control_number} mono />
                <Row label="Period" value={[claim.period_label, claim.semester, claim.academic_year].filter(Boolean).join(' · ')} />
                {claim.certified_at && <Row label="Certified" value={formatDate(claim.certified_at)} />}
                {claim.releasing_officer_name && <Row label="Releasing officer" value={claim.releasing_officer_name} />}
              </dl>
              <p className="mt-3 text-xs text-ink-500">Check these details against the printed stub and the student&apos;s ID before paying out.</p>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                setError(null)
                // Money is handed over with this: confirm the amount and the person first.
                const ok = await confirm({
                  title: `Release ${PHP.format(Number(claim.amount))}?`,
                  body: `To ${claim.recipient_name ?? 'the beneficiary'}. Recording it marks the stub claimed; the same QR can never be paid again.`,
                  confirmLabel: 'Record payout',
                })
                if (ok) release.mutate()
              }}
            >
              {!claim.releasing_officer_name && (
                <p role="alert" className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800">{MSG_NOT_SET}</p>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-ink-700">Banking Office PIN</span>
                <div className="relative mt-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-350" />
                  {/* one-time-code: browsers must not offer a saved login password here. */}
                  <input type="password" name="ubo-pin" inputMode="numeric" autoComplete="one-time-code" value={pin} maxLength={8}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className={`${INPUT} pl-9`} />
                </div>
              </label>
              {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
              <button type="submit" disabled={release.isPending || !pin || !claim.releasing_officer_name}
                className="w-full rounded-xl bg-success-600 px-4 py-3 text-sm font-semibold text-white hover:bg-success-700 disabled:opacity-50 transition-colors">
                {release.isPending ? 'Recording…' : 'Confirm payout released'}
              </button>
              <p className="text-center text-[11px] text-ink-350">Confirm only after the cash has been handed to the student.</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm focus:border-brand-700 focus:outline-none'

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`text-right font-medium text-ink-900 ${mono ? 'font-mono text-xs leading-5' : ''}`}>{value}</dd>
    </div>
  )
}
