import Link from 'next/link'
import { Clock, FileText } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime } from '@/lib/utils/formatDate'
import { formatHours } from '@/lib/utils/formatHours'
import type { TimeLog } from '@/types/attendance.types'

interface TimeLogCardProps {
  log: TimeLog
  showNarrativeLink?: boolean
}

export function TimeLogCard({ log, showNarrativeLink = true }: TimeLogCardProps) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-ink-900">{log.date}</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDateTime(log.time_in)}</span>
            {log.time_out && (
              <>
                <span>→</span>
                <span>{formatDateTime(log.time_out)}</span>
              </>
            )}
          </div>
          {log.duration_hours != null && (
            <p className="mt-1 text-sm font-medium text-brand-700">
              Duration: {formatHours(log.duration_hours)}
            </p>
          )}
        </div>
        <StatusBadge status={log.status} />
      </div>

      {log.rejection_reason && (
        <div className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
          Rejection reason: {log.rejection_reason}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        {!log.has_narrative && log.status === 'open' && showNarrativeLink && (
          <Link
            href={`/recipient/narrative/${log.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Submit Narrative
          </Link>
        )}
        {log.has_narrative && (
          <span className="flex items-center gap-1 text-xs text-success-600 font-medium">
            <FileText className="h-3.5 w-3.5" />
            Narrative submitted
          </span>
        )}
      </div>
    </div>
  )
}
