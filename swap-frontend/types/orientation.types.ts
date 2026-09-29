// Hand-mirrored from the backend: OrientationSessionResource, OrientationService::candidates,
// and Applicant\OrientationController.

export type OrientationMode = 'in_person' | 'online'
export type OrientationAttendanceStatus = 'invited' | 'attended' | 'absent'

export interface OrientationAttendee {
  user_id: number
  name: string | null
  student_id: string | null
  status: OrientationAttendanceStatus
  marked_at: string | null
}

export interface OrientationSession {
  id: number
  title: string
  scheduled_at: string
  mode: OrientationMode
  location: string | null
  meeting_link: string | null
  notes: string | null
  created_by?: string | null
  attendees?: OrientationAttendee[]
  created_at: string | null
}

export interface OrientationSessionInput {
  title: string
  scheduled_at: string
  mode: OrientationMode
  location?: string | null
  meeting_link?: string | null
  notes?: string | null
}

export interface OrientationCandidate {
  user_id: number
  name: string
  student_id: string | null
  email: string
  orientation_status: OrientationAttendanceStatus | 'not_invited'
  session_title: string | null
  session_at: string | null
}

export interface MyOrientation {
  id: number
  title: string
  scheduled_at: string
  mode: OrientationMode
  location: string | null
  meeting_link: string | null
  notes: string | null
  status: OrientationAttendanceStatus
}

// Same wording as OrientationService::MSG_NOT_ORIENTED.
export const MSG_NOT_ORIENTED = 'This applicant has not attended an orientation yet. Mark their attendance, or place them anyway.'
