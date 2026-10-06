import type { ReportCell, ReportColumnType } from '@/types/report.types'

export const NUMERIC_TYPES: ReportColumnType[] = ['number', 'hours', 'money', 'percent']

const trim = (n: number, digits: number) =>
  Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: digits })

/** A cell as the table shows it — the same rules the PDF prints with (ReportPdfService::cell). */
export function formatCell(value: ReportCell, type: ReportColumnType): string {
  if (value === null || value === '') return '—'
  switch (type) {
    case 'money': return '₱' + Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'hours': return trim(Number(value), 2)
    case 'percent': return trim(Number(value), 1) + '%'
    case 'number': return trim(Number(value), 2)
    default: return String(value)
  }
}

/** Badge colours for status cells, keyed by the label the backend sends. */
const GOOD = ['Approved', 'Active', 'Released', 'Qualified', 'Verified', 'Complete', 'On Track', 'Accepted · Eligible', 'Has Slots', 'Yes']
const BAD = ['Rejected', 'Deficient', 'Void', 'Voided', 'Behind', 'Missing', 'Accepted · Not eligible', 'Full', 'Suspended']
const WARN = ['Pending', 'Pending Verification', 'Under Review', 'Waiting', 'Deficient · Note Pending', 'Not Released', 'Still Open']
const INFO = ['Submitted', 'In Progress', 'Interview Scheduled', 'Completed', 'Deficient · Note Approved', 'Open']

export function statusTone(label: string): string {
  if (GOOD.includes(label)) return 'bg-success-50 text-success-800'
  if (BAD.includes(label)) return 'bg-danger-50 text-danger-700'
  if (WARN.includes(label)) return 'bg-warning-50 text-warning-800'
  if (INFO.includes(label)) return 'bg-info-50 text-info-700'
  return 'bg-ink-100 text-ink-600'
}

/** Seal-derived series order: green, gold, maroon, blue, teal, violet, grey. */
export const SERIES = ['#1F5B3A', '#D4AE22', '#A31A1E', '#2F5D8A', '#1F8163', '#6B4E9A', '#8C968F']
