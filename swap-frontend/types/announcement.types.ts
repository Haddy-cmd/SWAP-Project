// Hand-mirrored from the backend AnnouncementResource.

/** A photo or document sent with an announcement (AnnouncementAttachment::summary). */
export interface AnnouncementAttachment {
  id: number
  name: string
  mime: string
  size: number
  is_image: boolean
  /** Path under the API base; open it with announcementFileUrl(). */
  url: string
}

/** Who it reaches (AnnouncementService): everyone = recipients + supervisors; office = its students + supervisors. */
export type AnnouncementAudience = 'everyone' | 'office' | 'recipients' | 'new_recipients' | 'supervisors'

export interface Announcement {
  id: number
  title: string
  message: string
  audience: AnnouncementAudience
  office_id: number | null
  /** "Everyone", "Recipients", "Supervisors" or the office's name. */
  audience_label: string
  sent_by?: string | null
  recipient_count: number
  // How many the email reached (short of recipient_count when mail failed).
  emailed_count: number
  attachments?: AnnouncementAttachment[]
  created_at: string | null
}

export interface AnnouncementListMeta {
  current_page: number
  last_page: number
  total: number
  // Who a new announcement would reach right now.
  active_recipients: number
  audiences: { everyone: number; recipients: number; new_recipients?: number; supervisors: number }
  /** Each office: its placed students + its supervisors. */
  offices: { id: number; name: string; count: number }[]
}
