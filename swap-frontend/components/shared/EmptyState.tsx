import type { LucideIcon } from 'lucide-react'
import { FileSearch } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileSearch,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5F9]">
        <Icon className="h-8 w-8 text-[#64748B]" />
      </div>
      <h3 className="text-lg font-semibold text-[#1E293B]">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[#64748B]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
