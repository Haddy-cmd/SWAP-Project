'use client'

import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatHours } from '@/lib/utils/formatHours'
import { formatDate } from '@/lib/utils/formatDate'
import { TermBadge } from '@/components/shared/TermBadge'
import type { TermHistoryItem } from '@/types/assignment.types'

// A release is final; claimed/certified/pending are legacy stubs from before 2026-10-05.
const STIPEND: Record<string, string> = {
  released: 'Stipend released',
  claimed: 'Stipend received',
  certified: 'Stipend released',
  pending: 'Stipend released',
  void: 'Stipend stub voided',
}

/**
 * Hours page: the recipient's earlier terms. Each term's hours stay with it — a new
 * term always starts from zero.
 */
export function PastTermsCard() {
  const { data: terms = [] } = useQuery({
    queryKey: ['term-history'],
    queryFn: () => attendanceApi.getTermHistory(),
  })

  if (!terms.length) return null

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-4 w-4 text-brand-700" />
        <h2 className="font-semibold text-ink-900">Past terms</h2>
      </div>
      <p className="mb-4 text-sm text-ink-500">Hours from earlier terms stay with that term and don&apos;t carry over.</p>
      <ul className="divide-y divide-ink-100">
        {terms.map((t: TermHistoryItem) => (
          <li key={t.assignment_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-ink-900">{t.semester} {t.academic_year}</p>
              <p className="text-xs text-ink-500">
                {t.office ?? '—'} · {formatHours(t.verified_hours)} verified of {t.required_hours}h
                {t.stipend_status ? ` · ${STIPEND[t.stipend_status] ?? t.stipend_status}` : ''}
                {t.stipend_amount != null ? ` · ₱${t.stipend_amount.toLocaleString('en-PH')}` : ''}
                {t.stipend_released_at ? ` on ${formatDate(t.stipend_released_at)}` : ''}
              </p>
            </div>
            <TermBadge badge={t.term_badge} deficientHours={t.deficient_hours} />
          </li>
        ))}
      </ul>
    </div>
  )
}
