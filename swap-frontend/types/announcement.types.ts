// Hand-mirrored from the backend AnnouncementResource.

export interface Announcement {
  id: number
  title: string
  message: string
  sent_by?: string | null
  recipient_count: number
  // How many the email reached (short of recipient_count when mail failed).
  emailed_count: number
  created_at: string | null
}

export interface AnnouncementListMeta {
  current_page: number
  last_page: number
  total: number
  // Who a new announcement would reach right now.
  active_recipients: number
}
