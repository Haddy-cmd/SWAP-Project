import { CheckCircle, Clock, XCircle, FileSearch, Calendar, Award } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { Application } from '@/types/application.types'

interface TimelineEvent {
  label: string
  date: string | null
  icon: React.ReactNode
  active: boolean
  danger?: boolean
}

interface ApplicationTimelineProps {
  application: Application
}

export function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const events: TimelineEvent[] = [
    {
      label: 'Submitted',
      date: application.created_at,
      icon: <FileSearch className="h-4 w-4" />,
      active: true,
    },
    {
      label: 'Under Review',
      date: null,
      icon: <Clock className="h-4 w-4" />,
      active: ['under_review', 'interview_scheduled', 'approved', 'rejected'].includes(application.status),
    },
    {
      label: 'Interview Scheduled',
      date: application.interview_date ?? null,
      icon: <Calendar className="h-4 w-4" />,
      active: application.status === 'interview_scheduled' || application.interview_date != null,
    },
    {
      label: application.status === 'rejected' ? 'Rejected' : 'Approved',
      date: application.reviewed_at ?? null,
      icon:
        application.status === 'rejected' ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Award className="h-4 w-4" />
        ),
      active: application.status === 'approved' || application.status === 'rejected',
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
    <ol className="relative border-l-2 border-[#EAD9D9] pl-6 space-y-6">
      {events.map((event, idx) => (
        <li key={idx} className="relative">
          <div
            className={`absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              event.active
                ? event.danger
                  ? 'border-[#E74C3C] bg-red-50 text-[#E74C3C]'
                  : 'border-[#7D1A1A] bg-[#FEF0F0] text-[#7D1A1A]'
                : 'border-[#DCC5C5] bg-white text-[#B09A9A]'
            }`}
          >
            {event.icon}
          </div>
          <div className="pl-2">
            <p
              className={`text-sm font-semibold ${
                event.active
                  ? event.danger
                    ? 'text-[#E74C3C]'
                    : 'text-[#7D1A1A]'
                  : 'text-[#B09A9A]'
              }`}
            >
              {event.label}
            </p>
            {event.date && (
              <p className="mt-0.5 text-xs text-[#8A6A6A]">{formatDateTime(event.date)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
