export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'

export interface Application {
  id: number
  user_id: number
  academic_year: string
  semester: string
  status: ApplicationStatus
  type?: 'new' | 'renewal'
  renewal_context?: {
    office: string | null
    supervisor: string | null
    period: string
    verified_hours: number
    required_hours: number
    status: string
  } | null
  remarks: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  documents?: ApplicationDocument[]
  interview?: Interview | null
  user?: import('./auth.types').User
}

export interface ApplicationDocument {
  id: number
  application_id: number
  document_type: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
}

export interface Interview {
  id: number
  application_id: number
  scheduled_at: string
  location: string | null
  mode: 'in_person' | 'online'
  notes: string | null
  status: string
  history?: {
    from: string | null
    to: string | null
    changed_at: string
    changed_by: string | null
  }[]
}

export interface StoreApplicationData {
  academic_year: string
  semester: string
}

export interface ScheduleInterviewData {
  scheduled_at: string
  location?: string
  mode: 'in_person' | 'online'
  notes?: string
}

export interface DecideApplicationData {
  decision: 'approved' | 'rejected'
  remarks?: string
}
