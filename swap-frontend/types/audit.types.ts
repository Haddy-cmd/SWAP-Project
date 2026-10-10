// Hand-mirrored from AuditLogService::present / ::options (Admin → Audit Logs).

export type AuditArea = 'stipend' | 'hours' | 'applications' | 'terms' | 'placements' | 'accounts' | 'settings'
  | 'exports' | 'communication' | 'testing' | 'other'

export interface AuditChange {
  field: string
  before: string | null
  after: string | null
}

export interface AuditEntry {
  id: number
  action: string
  area: AuditArea
  area_label: string
  /** Voids, role changes, deletions, exports, password and settings changes. */
  sensitive: boolean
  /** A readable sentence, without the actor (shown beside it). */
  summary: string
  /** The record it is about, e.g. "Stipend SWAP-STP-…". */
  entity: string
  /** `type:id` for that record's own history, when it has one. */
  record: string | null
  actor: { id: number; name: string; role: string } | null
  subject: { id: number; name: string; student_id: string | null } | null
  changes: AuditChange[]
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditFilters {
  area?: string
  actor_id?: string
  subject?: string
  subject_user_id?: string
  record?: string
  from?: string
  to?: string
  sensitive?: '1'
  include_testing?: '1'
  page?: string
}

export interface AuditPage {
  data: AuditEntry[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

export interface AuditOptions {
  areas: { key: string; label: string }[]
  actors: { id: number; name: string; role: string }[]
}
