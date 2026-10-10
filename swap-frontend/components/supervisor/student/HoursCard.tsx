import { AlertTriangle, CheckCircle2, Clock, Flag, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PACE_META, paceDetail, type Pace, type PaceStatus } from '@/lib/utils/pace'
import { formatDay } from '@/lib/utils/semester'

export const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
export const fmtHrs = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))

/** Pace colours as theme tokens (readable in dark mode). */
export const PACE_TONE: Record<PaceStatus, { text: string; pill: string }> = {
  complete: { text: 'text-accent-strong', pill: 'bg-accent-soft text-accent-strong' },
  on_track: { text: 'text-info-700', pill: 'bg-info-100 text-info-700' },
  behind: { text: 'text-warning-700', pill: 'bg-warning-50 text-warning-700' },
  not_started: { text: 'text-ink-500', pill: 'bg-ink-100 text-ink-600' },
}

const PACE_ICON: Record<PaceStatus, LucideIcon> = { complete: CheckCircle2, on_track: TrendingUp, behind: AlertTriangle, not_started: Clock }

/** Verified + waiting against the requirement, with a marker where the elapsed term says they should be. */
export function HoursCard({ verified, pending, required, bonus, pace, startDate, endDate }: {
  verified: number; pending: number; required: number; bonus: number; pace: Pace
  startDate?: string | null; endDate?: string | null
}) {
  const remaining = Math.max(0, required - verified)
  const pct = (v: number) => (required > 0 ? Math.min(100, (v / required) * 100) : 0)
  const vW = pct(verified)
  const pW = Math.min(100 - vW, pct(pending))
  const expected = pace.expected_hours
  const meta = PACE_META[pace.status]
  const PaceIcon = PACE_ICON[pace.status]

  const note =
    verified <= 0 ? `No verified hours yet this period — ${fmtHrs(required)} hours required.`
      : remaining <= 0 ? `Requirement complete — all ${fmtHrs(required)} hours are verified.`
        : `${fmtHrs(remaining)} verified hours to go${pending > 0 ? `; ${fmtHrs(pending)}h are waiting for you` : ''}.`

  return (
    <section className={`${CARD} px-6 py-[22px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="text-[34px] font-extrabold text-ink-950">{fmtHrs(verified)}h</span>
          <span className="ml-1.5 text-[14px] text-ink-500">of {fmtHrs(required)}h verified</span>
        </div>
        <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${PACE_TONE[pace.status].text}`} title={paceDetail(pace)}>
          <PaceIcon className="h-[17px] w-[17px]" /> {pace.status === 'behind' ? paceDetail(pace) : meta.label}
        </span>
      </div>

      <div className="relative mt-3.5 h-3 rounded-lg bg-ink-100">
        <div className="absolute inset-y-0 left-0 rounded-lg bg-accent" style={{ width: `${vW}%` }} />
        {pW > 0 && <div className="absolute inset-y-0 rounded-r-lg bg-gold-accent" style={{ left: `${vW}%`, width: `${pW}%` }} />}
        {expected != null && expected > 0 && required > 0 && (
          <div title={`Where they should be today: ${fmtHrs(expected)}h`}
            className="absolute -bottom-[5px] -top-[5px] w-0.5 rounded bg-ink-950" style={{ left: `${pct(expected)}%` }} />
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[11.5px] text-ink-500">
        <span>{startDate ? formatDay(startDate) : ''}</span>
        {expected != null && expected > 0 && <span className="font-bold text-ink-900">Expected today: {fmtHrs(expected)}h</span>}
        <span>{endDate ? `Ends ${formatDay(endDate)}` : 'End date not set'}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-ink-900/[.06] pt-3.5 text-[13px] text-ink-700">
        <span className="flex items-center gap-[7px]"><span className="h-2.5 w-2.5 rounded-[3px] bg-accent" /><strong className="text-ink-950">{fmtHrs(verified)}h</strong> verified</span>
        <span className="flex items-center gap-[7px]"><span className="h-2.5 w-2.5 rounded-[3px] bg-gold-accent" /><strong className="text-ink-950">{fmtHrs(pending)}h</strong> waiting</span>
        <span className="flex items-center gap-[7px]"><span className="h-2.5 w-2.5 rounded-[3px] border border-ink-300 bg-ink-100" /><strong className="text-ink-950">{fmtHrs(remaining)}h</strong> to go</span>
        {bonus > 0 && <span className="flex items-center gap-[7px]"><span className="h-2.5 w-2.5 rounded-[3px] bg-violet-600" /><strong className="text-ink-950">{fmtHrs(bonus)}h</strong> bonus</span>}
      </div>
      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-500"><Flag className="mt-px h-4 w-4 flex-none text-gold-600" /> {note}</p>
    </section>
  )
}
