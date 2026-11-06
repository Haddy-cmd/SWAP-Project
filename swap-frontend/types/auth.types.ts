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
  signature_url?: string | null
  /** GET /profile only: a signature is on record but its file is gone from storage, so it must be drawn again. */
  signature_missing?: boolean
  /** GET /profile only: when the password last changed (from the audit log); null if never. */
  password_changed_at?: string | null
  position_title?: string | null
  /** Supervisors and admins: their employee ID (digits). */
  employee_id?: string | null
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
  /** "Trust this browser for 30 days" token from an earlier sign-in (skips the emailed code). */
  device_token?: string | null
}

/** Sign-in step one when a code is needed: the code was emailed; finish with verifyLoginCode. */
export interface LoginChallenge {
  otp_required: true
  challenge: string
  email_hint: string
  message: string
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
  privacy_consent: boolean
}

export interface AuthResponse {
  data: User
  token: string
  message: string
  /** Only when the browser was trusted at the code step; store it (lib/utils/trustedDevice). */
  device_token?: string
}

export const isLoginChallenge = (r: AuthResponse | LoginChallenge): r is LoginChallenge => 'otp_required' in r

// Registration no longer auto-logs in — it asks the user to verify their email.
export interface RegisterResponse {
  message: string
  /** The form is held (30 minutes) until the emailed code is confirmed; no account exists yet. */
  pending?: boolean
  email?: string
}

/** Profile → Security: one live login of this account. */
export interface ProfileSession {
  id: number
  device: string
  kind: 'phone' | 'tablet' | 'desktop' | 'unknown'
  ip_address: string | null
  last_used_at: string | null
  created_at: string | null
  current: boolean
}

/** Profile → Activity: something this person did, as one sentence. */
export interface MyActivityEntry {
  id: number
  action: string
  area: string
  summary: string
  created_at: string
}
