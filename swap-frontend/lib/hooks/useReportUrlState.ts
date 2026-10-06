'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { buildReportUrl, drillTo, parseReportUrl, type ReportDrill, type ReportUrlState } from '@/lib/utils/reportQuery'

/**
 * Analytics & Reports state, read from and written to the URL (see reportQuery.ts).
 * Writes use router.replace for filter/sort tweaks and router.push for tab changes,
 * so Back returns to the previous tab rather than undoing each checkbox.
 */
export function useReportUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const state = useMemo(() => parseReportUrl(new URLSearchParams(params.toString())), [params])

  const write = useCallback((next: ReportUrlState, push = false) => {
    const qs = buildReportUrl(next)
    const url = qs ? `${pathname}?${qs}` : pathname
    if (push) router.push(url, { scroll: false })
    else router.replace(url, { scroll: false })
  }, [pathname, router])

  /** Change filters/sort/grouping on the current tab. */
  const update = useCallback((patch: Partial<ReportUrlState>) => write({ ...state, ...patch }), [state, write])

  /** Switch tab, keeping only the term. */
  const openTab = useCallback((tab: string) => write(drillTo(state, { tab }), true), [state, write])

  /** Jump from the Overview into a filtered report. */
  const drill = useCallback((d: ReportDrill) => write(drillTo(state, d), true), [state, write])

  /** Change the term; filters are cleared because their values belong to the old term. */
  const setTerm = useCallback((ay: string, sem: string) => write({ ...state, ay, sem, filters: {} }), [state, write])

  return { state, update, openTab, drill, setTerm }
}
