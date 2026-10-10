'use client'

import { useState } from 'react'
import { ArrowRight, ChevronDown, ShieldAlert } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { AuditArea, AuditEntry } from '@/types/audit.types'

// Area badge colours: one per area, never the status palette (sensitive has its own flag).
const AREA_STYLE: Record<AuditArea, string> = {
  stipend: 'bg-gold-50 text-gold-700',
  hours: 'bg-success-50 text-success-700',
  applications: 'bg-info-50 text-brand-700',
  terms: 'bg-violet-50 text-violet-700',
  placements: 'bg-brand-50 text-brand-700',
  accounts: 'bg-ink-100 text-ink-700',
  settings: 'bg-ink-100 text-ink-700',
  exports: 'bg-ink-100 text-ink-700',
  communication: 'bg-info-50 text-brand-700',
  testing: 'bg-amber-50 text-amber-800',
  other: 'bg-ink-100 text-ink-600',
}

/**
 * One audit entry: when, who, a readable sentence, its area; click to see what changed
 * (before → after) and where it came from. `compact` drops the area badge and student
 * (the History panels already show one record).
 */
export function AuditEntryRow({ entry, compact = false }: { entry: AuditEntry; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const expandable = entry.changes.length > 0 || !!entry.ip_address

  return (
    <li className="border-b border-ink-100 last:border-0">
      <button type="button" onClick={() => expandable && setOpen((o) => !o)} aria-expanded={open}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left ${expandable ? 'hover:bg-ink-50' : 'cursor-default'}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug text-ink-900">
            <span className="font-semibold">{entry.actor?.name ?? 'System'}</span>
            {entry.actor && <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{entry.actor.role}</span>}
            <span className="text-ink-500"> · </span>
            {entry.summary}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-500">
            <span>{formatDateTime(entry.created_at)}</span>
            {!compact && (
              <span className={`rounded-full px-2 py-px text-[10.5px] font-semibold ${AREA_STYLE[entry.area] ?? AREA_STYLE.other}`}>{entry.area_label}</span>
            )}
            {entry.sensitive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-px text-[10.5px] font-semibold text-danger-700">
                <ShieldAlert className="h-3 w-3" /> Sensitive
              </span>
            )}
            {!compact && entry.subject && (
              <span>About {entry.subject.name}{entry.subject.student_id ? ` · ID ${entry.subject.student_id}` : ''}</span>
            )}
          </p>
        </div>
        {expandable && <ChevronDown className={`mt-1 h-4 w-4 flex-none text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-3">
          {entry.changes.length > 0 && (
            <table className="w-full overflow-hidden rounded-lg border border-ink-100 text-[12px]">
              <thead className="bg-ink-50 text-left text-ink-500">
                <tr><th className="px-3 py-1.5 font-semibold">Field</th><th className="px-3 py-1.5 font-semibold">Before</th><th className="w-6" /><th className="px-3 py-1.5 font-semibold">After</th></tr>
              </thead>
              <tbody>
                {entry.changes.map((c) => (
                  <tr key={c.field} className="border-t border-ink-100 align-top">
                    <td className="px-3 py-1.5 font-medium text-ink-700">{c.field}</td>
                    <td className="break-all px-3 py-1.5 text-ink-500">{c.before ?? '—'}</td>
                    <td className="py-1.5"><ArrowRight className="h-3 w-3 text-ink-300" /></td>
                    <td className="break-all px-3 py-1.5 text-ink-900">{c.after ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-ink-400">
            {entry.entity}
            {entry.ip_address && <> · IP <span className="font-mono">{entry.ip_address}</span></>}
            {entry.user_agent && <span className="block truncate" title={entry.user_agent}>{entry.user_agent}</span>}
          </p>
        </div>
      )}
    </li>
  )
}
