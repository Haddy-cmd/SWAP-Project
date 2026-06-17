export interface Assignment {
  id: number
  user_id: number
  office_id: number
  supervisor_id: number
  academic_year: string
  semester: string
  required_hours: number
  start_date: string
  end_date: string | null
  status: 'active' | 'completed' | 'suspended'
  qr_code: string | null
  rendered_hours: number
  verified_hours: number
  remaining_hours: number
  created_at: string
  user?: import('./auth.types').User
  office?: Office
  supervisor?: import('./auth.types').User
}

export interface Office {
  id: number
  name: string
  code: string
  description: string | null
  head_name: string | null
  location: string | null
  max_recipients: number
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  radius_meters: number | null
  geofence_enabled: boolean
  qr_code?: string | null
  active_recipients?: number
  supervisors_count?: number
}

export interface CreateAssignmentData {
  user_id: number
  office_id: number
  supervisor_id: number
  academic_year: string
  semester: string
  required_hours: number
  start_date: string
  end_date?: string
}
