import { CheckCircle, Clock, XCircle, FileSearch, Calendar, Award } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { Application } from '@/types/application.types'

interface TimelineEvent {
  label: string
  date: string | null
  detail?: string
  icon: React.ReactNode
  active: boolean
  danger?: boolean
}

interface ApplicationTimelineProps {
  application: Application
}

/**
 * Submitted → under review → interview → decision → recipient, each dated from the
 * application's status history (the audit log) where the step was reached.
 */
export function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const reached = (status: string) => application.status_history?.find((h) => h.status === status)?.at ?? null
  const decided = application.status === 'approved' || application.status === 'rejected'
  const renewal = application.type === 'renewal'
  const interview = application.interview ?? null
  const noShow = interview?.status === 'no_show'

  const events: TimelineEvent[] = [
    {
      label: 'Submitted',
      date: application.created_at,
      icon: <FileSearch className="h-4 w-4" />,
      active: true,
    },
    {
      label: 'Under Review',
      date: reached('under_review'),
      icon: <Clock className="h-4 w-4" />,
      active: ['under_review', 'interview_scheduled', 'approved', 'rejected'].includes(application.status),
    },
    // Renewals skip the interview: the recipient already went through it.
    ...(renewal ? [] : [{
      label: noShow ? 'Interview Missed' : 'Interview Scheduled',
      date: reached('interview_scheduled'),
      detail: interview ? `Interview on ${formatDateTime(interview.scheduled_at)}${noShow ? ' — marked as a no-show' : ''}` : undefined,
      icon: <Calendar className="h-4 w-4" />,
      active: application.status === 'interview_scheduled' || interview != null,
      danger: noShow,
    }]),
    {
      label: application.status === 'rejected' ? 'Rejected' : 'Approved',
      date: application.reviewed_at ?? reached(application.status === 'rejected' ? 'rejected' : 'approved'),
      icon:
        application.status === 'rejected' ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Award className="h-4 w-4" />
        ),
      active: decided,
      danger: application.status === 'rejected',
    },
    {
      label: 'Enrolled as Recipient',
      date: null,
      icon: <CheckCircle className="h-4 w-4" />,
      active: application.status === 'approved',
    },
  ]

  return (
    <ol className="relative border-l-2 border-ink-200 pl-6 space-y-6">
      {events.map((event, idx) => (
        <li key={idx} className="relative">
          <div
            className={`absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              event.active
                ? event.danger
                  ? 'border-danger-600 bg-danger-50 text-danger-600'
                  : 'border-brand-700 bg-brand-50 text-brand-700'
                : 'border-ink-300 bg-white text-ink-400'
            }`}
          >
            {event.icon}
          </div>
          <div className="pl-2">
            <p
              className={`text-sm font-semibold ${
                event.active
                  ? event.danger
                    ? 'text-danger-600'
                    : 'text-brand-700'
                  : 'text-ink-400'
              }`}
            >
              {event.label}
            </p>
            {event.date && (
              <p className="mt-0.5 text-xs text-ink-500">{formatDateTime(event.date)}</p>
            )}
            {event.detail && <p className="mt-0.5 text-xs text-ink-600">{event.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
