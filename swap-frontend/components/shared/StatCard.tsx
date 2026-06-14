import { cn } from '@/lib/utils/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: number
  className?: string
  iconClassName?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#EAD9D9] bg-white p-6 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#64748B]">{title}</p>
        <div className={cn('rounded-lg p-2 bg-[#FEF0F0]', iconClassName)}>
          <Icon className="h-5 w-5 text-[#7D1A1A]" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-[#1E293B]">{value}</p>
      {(description || trend !== undefined) && (
        <div className="mt-2 flex items-center gap-1">
          {trend !== undefined && (
            <span
              className={cn(
                'text-xs font-medium',
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
          {description && (
            <p className="text-xs text-[#64748B]">{description}</p>
          )}
        </div>
      )}
    </div>
  )
}
