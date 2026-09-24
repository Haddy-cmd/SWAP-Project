export type PromissoryStatus = 'pending' | 'approved' | 'rejected'

export interface PromissoryNote {
  id: number
  assignment_id: number
  user_id: number
  academic_year: string
  semester: string
  verified_hours_snapshot: number
  lacking_hours: number | null
  makeup_deadline: string | null
  overdue: boolean
  file_name: string
  mime_type: string | null
  file_url: string
  reason: string
  status: PromissoryStatus
  review_remarks: string | null
  reviewed_at: string | null
  created_at: string
  student?: { id: number; name: string }
  reviewer?: { id: number; name: string } | null
}

export interface PromissorySubmission {
  can_submit: boolean
  reason: string | null
  assignment_id: number | null
  lacking_hours: number | null
}
