import { toPercent, formatPercent, formatHours } from '@/lib/utils/formatHours'
import type { HoursSummary } from '@/types/attendance.types'

interface HoursProgressProps {
  summary: HoursSummary
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = toPercent(value, max)
  // Keep a faint visible sliver for any non-zero progress so short sessions still register.
  const width = pct > 0 && pct < 1.5 ? 1.5 : pct
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function HoursProgress({ summary }: HoursProgressProps) {
  const { required, verified, pending, rejected, remaining } = summary

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium text-ink-900">Verified Hours</span>
          <span className="text-success-600 font-semibold">
            {formatHours(verified)} / {formatHours(required)} ({formatPercent(verified, required)}%)
          </span>
        </div>
        <ProgressBar value={verified} max={required} color="bg-success-600" />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium text-ink-900">Pending Verification</span>
          <span className="text-warning-600 font-semibold">{formatHours(pending)}</span>
        </div>
        <ProgressBar value={pending} max={required} color="bg-warning-600" />
      </div>

      {rejected > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium text-ink-900">Rejected</span>
            <span className="text-danger-600 font-semibold">{formatHours(rejected)}</span>
          </div>
          <ProgressBar value={rejected} max={required} color="bg-danger-600" />
        </div>
      )}

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-sm font-medium text-ink-500">Remaining Hours Needed</p>
        <p className="mt-1 text-2xl font-bold text-brand-700">{formatHours(remaining)}</p>
      </div>
    </div>
  )
}
