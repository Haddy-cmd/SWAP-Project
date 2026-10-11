export interface Notification {
  id: string
  type: string
  data: {
    title: string
    message: string
    type: string
    /** New-application notifications (admins): who, new | renewal, the term, a repeat tag. */
    applicant_name?: string | null
    kind?: 'new' | 'renewal'
    term?: string | null
    note?: string | null
    [key: string]: unknown
  }
  read_at: string | null
  is_read: boolean
  created_at: string
}
