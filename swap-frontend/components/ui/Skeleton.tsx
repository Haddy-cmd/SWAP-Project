/**
 * Loading placeholders with one look everywhere: the shimmer comes from `.animate-pulse`
 * in globals.css. Size them like the content they stand in for, so nothing jumps.
 */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-ink-100 ${className}`} />
}

/** A list of rows, e.g. a table or queue while it loads. */
export function SkeletonRows({ rows = 3, className = 'h-12' }: { rows?: number; className?: string }) {
  return (
    <div aria-busy className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`w-full ${className}`} />)}
    </div>
  )
}

/** A stat card: label, big number, hint. */
export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`rounded-[18px] border border-ink-900/[.08] bg-surface px-5 py-4 ${className}`}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2.5 h-3 w-28" />
    </div>
  )
}
