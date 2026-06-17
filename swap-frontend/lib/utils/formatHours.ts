export function formatHours(hours: number): string {
  const totalMinutes = Math.round((hours ?? 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Precise progress percentage, clamped to 0–100 and kept to one decimal so that
 * sub-hour durations (e.g. 0.25h of 120h ≈ 0.2%) still register instead of rounding to 0.
 */
export function toPercent(value: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((value / total) * 1000) / 10)
}

/** Human-friendly percentage label: shows one decimal only when it is non-zero (e.g. "0.2", "50"). */
export function formatPercent(value: number, total: number): string {
  const pct = toPercent(value, total)
  return Number.isInteger(pct) ? `${pct}` : pct.toFixed(1)
}
