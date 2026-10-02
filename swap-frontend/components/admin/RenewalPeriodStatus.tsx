'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

/**
 * Admin → Applications: whether returning recipients can renew right now. The window
 * itself is opened per semester under Admin → Semesters.
 */
export function RenewalPeriodStatus() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['application-status'],
    queryFn: () => settingsApi.getApplicationStatus(),
  })

  if (isLoading) return <div className="h-[72px] animate-pulse rounded-2xl bg-ink-200/50" />

  const renewal = status?.renewal
  const open = !!renewal?.open

  return (
    <Link href="/admin/semesters"
      className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition-colors hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${open ? 'bg-success-50' : 'bg-violet-100'}`}>
          <RefreshCw className={`h-5 w-5 ${open ? 'text-success-600' : 'text-violet-600'}`} />
        </div>
        <div>
          <p className="font-semibold text-ink-900">
            Renewal Period —{' '}
            <span className={open ? 'text-success-600' : 'text-violet-600'}>{open ? 'Open' : 'Closed'}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-500">
            {open
              ? `Returning recipients can submit an updated COR for ${renewal?.semester} ${renewal?.academic_year}.`
              : 'Open renewal for a semester under Semesters so returning recipients can renew.'}
          </p>
        </div>
      </div>
      <span className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-brand-700">
        Manage in Semesters <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}
