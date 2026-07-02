export type UserRole = 'applicant' | 'recipient' | 'supervisor' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  office_id?: number | null
  office_name?: string | null
  email_verified_at: string | null
  created_at: string
  avatar_url?: string | null
  profile?: StudentProfile
}

export interface StudentProfile {
  id: number
  user_id: number
  student_id_number: string
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  date_of_birth: string | null
  gender: string | null
  contact_number: string | null
  address: string | null
  college: string
  program: string
  year_level: number
  gpa: number | null
  photo_url: string | null
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  password_confirmation: string
  student_id_number: string
  first_name: string
  middle_name?: string
  last_name: string
  contact_number?: string
  college: string
  program: string
  year_level: number
}

export interface AuthResponse {
  data: User
  token: string
  message: string
}
