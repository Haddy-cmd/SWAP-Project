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
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  interview_scheduled: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  open: 'bg-blue-100 text-blue-700',
  pending_verification: 'bg-orange-100 text-orange-800',
  verified: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-800',
  released: 'bg-green-100 text-green-800',
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
  const style = STATUS_STYLES[status as Status] ?? 'bg-gray-100 text-gray-700'
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
