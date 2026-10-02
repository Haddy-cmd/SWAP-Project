// Hand-mirrored from the backend ConcernResource.

export type ConcernStatus = 'open' | 'in_progress' | 'resolved'

/** One message in a concern thread (ConcernMessage). */
export interface ConcernMessage {
  id: number
  /** From the DSA (true) or the student (false). */
  from_staff: boolean
  author: string | null
  body: string
  created_at: string | null
}

export interface Concern {
  id: number
  subject: string
  message: string
  status: ConcernStatus
  response: string | null
  responded_at: string | null
  responded_by?: string | null
  created_at: string | null
  /** The whole conversation, oldest first (opener + every reply). */
  messages?: ConcernMessage[]
  // Admin inbox only.
  user?: { id: number; name: string; email: string; role: string; student_id_number?: string | null } | null
}

export const CONCERN_STATUS_META: Record<ConcernStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-warning-50 text-warning-700' },
  in_progress: { label: 'In progress', cls: 'bg-info-50 text-brand-700' },
  resolved: { label: 'Resolved', cls: 'bg-success-50 text-success-700' },
}
