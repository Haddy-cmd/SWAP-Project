import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { RenewalReadiness } from '@/types/application.types'

const PAYMENT: Record<RenewalReadiness['payment'], string> = {
  paid: 'Stipend released',
  not_required: 'No hours were required',
  owed: 'Stipend owed — release it first',
  promissory: 'Covered by an approved promissory note (not yet paid)',
  unpaid: 'Not paid, no approved promissory note',
}

/**
 * Admin → Applications, for a renewal: what approving still needs from the renewed
 * term, in the order the backend checks it (RenewalReadinessService). The approval
 * is refused with the same first blocker.
 */
export function RenewalReadinessPanel({ readiness }: { readiness: RenewalReadiness }) {
  const report = readiness.report
  const paidOk = readiness.payment === 'paid' || readiness.payment === 'not_required' || readiness.payment === 'promissory'
  const items: { ok: boolean | null; label: string; detail?: string }[] = [
    { ok: readiness.cor_attached, label: readiness.cor_attached ? 'Updated COR attached' : 'No updated COR attached' },
    {
      ok: readiness.term_status === null ? null : readiness.term_status === 'qualified',
      label: readiness.term_status === 'qualified' ? 'Term qualified'
        : readiness.term_status === 'deficient' ? `Term deficient${readiness.deficient_hours ? ` by ${readiness.deficient_hours} hrs` : ''}`
        : `Term not closed yet${readiness.deficient_hours ? ` · ${readiness.deficient_hours} hrs short so far` : ''}`,
    },
    { ok: paidOk, label: PAYMENT[readiness.payment] },
    { ok: report.submitted, label: report.submitted ? 'End-of-term report submitted' : 'End-of-term report missing' },
    // Completed hours: the supervisor must accept the report as eligible. Short hours: the
    // approved note + report are enough, but a "not eligible" mark still blocks.
    ...(readiness.hours_met || report.accepted
      ? [{
          ok: report.accepted ? report.renewal_eligible === true : false,
          label: report.accepted
            ? `Report accepted · ${report.renewal_eligible ? 'Eligible for renewal' : 'Not eligible for renewal'}`
            : 'Report not accepted by the supervisor yet',
          detail: report.remarks ? `“${report.remarks}”${report.reviewer ? ` — ${report.reviewer}` : ''}` : undefined,
        }]
      : [{ ok: null, label: 'Short on hours: the approved promissory note and the report are enough' }]),
    ...(readiness.carry_hours > 0
      ? [{ ok: null, label: `On approval, ${readiness.carry_hours} lacking hours are added to the next term` }]
      : []),
  ]

  return (
    <div className="mt-3 border-t border-violet-200 pt-3">
      <ul className="space-y-1.5 text-[12.5px] text-ink-700">
        {items.map((it) => {
          const Icon = it.ok === null ? CircleDashed : it.ok ? CheckCircle2 : CircleAlert
          return (
            <li key={it.label} className="flex items-start gap-2">
              <Icon className={cn('mt-0.5 h-3.5 w-3.5 flex-none', it.ok === null ? 'text-ink-400' : it.ok ? 'text-success-600' : 'text-danger-600')} />
              <span>
                {it.label}
                {it.detail && <span className="block text-[11.5px] italic text-ink-500">{it.detail}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      <p className={cn('mt-2.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold',
        readiness.ready ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-700')}>
        {readiness.ready ? 'Ready to approve.' : `Blocked: ${readiness.blocker}`}
      </p>
      {/* A "not eligible" mark never clears by waiting: the admin rejects the renewal. */}
      {report.renewal_eligible === false && (
        <p className="mt-2 text-[12px] leading-relaxed text-danger-700">
          Approval stays locked. Reject this renewal below to close their placement and return them to the
          applicant portal (they keep their past terms and any stipend still owed).
        </p>
      )}
    </div>
  )
}
