import Link from 'next/link'
import { FileText, Calendar } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils/formatDate'
import type { Application } from '@/types/application.types'

interface ApplicationCardProps {
  application: Application
  href: string
}

export function ApplicationCard({ application, href }: ApplicationCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-[#EAD9D9] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FEF0F0]">
            <FileText className="h-5 w-5 text-[#7D1A1A]" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#1E293B]">
              {application.academic_year} — {application.semester}
            </p>
            {application.user?.name && (
              <p className="mt-0.5 truncate text-sm text-[#8A6A6A]">
                {application.user.name}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-[#8A6A6A]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Submitted {formatDate(application.created_at)}
        </span>
        {application.reviewed_at && (
          <span>Reviewed {formatDate(application.reviewed_at)}</span>
        )}
      </div>
    </Link>
  )
}
