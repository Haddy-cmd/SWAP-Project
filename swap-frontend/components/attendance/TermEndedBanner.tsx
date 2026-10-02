import Link from 'next/link'
import { ArrowRight, BadgeCheck, CircleAlert, FileClock, FileCheck2 } from 'lucide-react'
import { formatHours } from '@/lib/utils/formatHours'
import type { Assignment } from '@/types/assignment.types'

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

/**
 * Recipient dashboard: once the current placement's term has ended, say how it went —
 * Qualified, or Deficient with the hours short and what to do about it. Uses the
 * recorded verdict when the end-of-semester check has run, else the hours themselves.
 */
export function TermEndedBanner({ assignment }: { assignment: Assignment }) {
  const end = assignment.effective_end_date
  if (!end || end >= manilaToday()) return null

  const term = `${assignment.semester} ${assignment.academic_year}`
  const short = assignment.term_status === 'deficient'
    ? assignment.deficient_hours ?? Math.max(0, assignment.required_hours - assignment.verified_hours)
    : Math.max(0, assignment.required_hours - assignment.verified_hours)
  const qualified = assignment.term_status === 'qualified' || (assignment.term_status == null && short <= 0)

  if (qualified) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
        <BadgeCheck className="h-5 w-5 flex-none text-success-600" />
        <p className="text-sm text-success-800"><strong>{term} ended: Qualified.</strong> You completed the required hours.</p>
      </div>
    )
  }

  const badge = assignment.term_badge
  const { Icon, text } = badge === 'promissory_approved'
    ? { Icon: FileCheck2, text: 'Your promissory note is approved. Render the makeup hours before the deadline.' }
    : badge === 'promissory_pending'
      ? { Icon: FileClock, text: 'Your promissory note is waiting for your supervisor’s review.' }
      : { Icon: CircleAlert, text: 'Submit a promissory note on the Stipend page.' }

  return (
    <Link href="/recipient/stipend"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4 transition-colors hover:bg-danger-100/60">
      <Icon className="h-5 w-5 flex-none text-danger-600" />
      <p className="min-w-0 flex-1 text-sm text-danger-800">
        <strong>{term} ended: Deficient by {formatHours(short)}.</strong> {text}
      </p>
      <ArrowRight className="h-4 w-4 flex-none text-danger-700" />
    </Link>
  )
}
