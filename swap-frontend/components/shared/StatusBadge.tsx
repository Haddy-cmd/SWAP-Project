import { cn } from '@/lib/utils/cn'

type Status =
  | 'submitted'
  | 'under_review'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'pending_verification'
  | 'verified'
  | 'active'
  | 'completed'
  | 'suspended'
  | 'pending'
  | 'released'

const STATUS_STYLES: Record<Status, string> = {
  submitted: 'bg-info-100 text-info-800',
  under_review: 'bg-warning-100 text-warning-800',
  interview_scheduled: 'bg-violet-100 text-violet-800',
  approved: 'bg-success-100 text-success-800',
  rejected: 'bg-danger-100 text-danger-800',
  open: 'bg-info-100 text-info-700',
  pending_verification: 'bg-warning-100 text-warning-800',
  verified: 'bg-success-100 text-success-800',
  active: 'bg-success-100 text-success-800',
  completed: 'bg-ink-100 text-ink-700',
  suspended: 'bg-danger-100 text-danger-700',
  pending: 'bg-warning-100 text-warning-800',
  released: 'bg-success-100 text-success-800',
}

const STATUS_LABELS: Record<Status, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  interview_scheduled: 'Interview Scheduled',
  approved: 'Approved',
  rejected: 'Rejected',
  open: 'Open',
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  active: 'Active',
  completed: 'Completed',
  suspended: 'Suspended',
  pending: 'Pending',
  released: 'Released',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as Status] ?? 'bg-ink-100 text-ink-700'
  const label = STATUS_LABELS[status as Status] ?? status.replace(/_/g, ' ')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}
