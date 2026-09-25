import { BarChart2 } from 'lucide-react'

/** Shown in place of a chart when there is no data for the selected period. */
export function EmptyChart({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
      <BarChart2 className="h-9 w-9 text-ink-300" />
      <p className="text-sm text-ink-350">{message}</p>
    </div>
  )
}
