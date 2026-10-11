import {
  Bell, CalendarClock, ClipboardList, Clock, FileText, Megaphone, MessageSquare, RefreshCw, UserRoundPlus, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Notification } from '@/types/notification.types'

export type KindKey = 'applications' | 'renewals' | 'hours' | 'reports' | 'stipend' | 'concerns' | 'announcements' | 'other'

export interface Kind {
  key: KindKey
  /** Chip label (plural) and the row's label (singular). */
  label: string
  one: string
  Icon: LucideIcon
  /** Tile colours (theme tokens). */
  tone: string
}

const KINDS: Record<KindKey, Omit<Kind, 'key'>> = {
  applications: { label: 'Applications', one: 'Application', Icon: UserRoundPlus, tone: 'bg-accent-soft text-accent-strong' },
  renewals: { label: 'Renewals', one: 'Renewal', Icon: RefreshCw, tone: 'bg-gold-50 text-warning-700' },
  hours: { label: 'Hours', one: 'Hours', Icon: Clock, tone: 'bg-brand-100 text-brand-700' },
  reports: { label: 'Reports & notes', one: 'Report', Icon: FileText, tone: 'bg-info-100 text-info-700' },
  stipend: { label: 'Stipend', one: 'Stipend', Icon: Wallet, tone: 'bg-gold-50 text-gold-700' },
  concerns: { label: 'Concerns', one: 'Concern', Icon: MessageSquare, tone: 'bg-violet-100 text-violet-600' },
  announcements: { label: 'Announcements', one: 'Announcement', Icon: Megaphone, tone: 'bg-danger-50 text-red-strong' },
  other: { label: 'Other', one: 'Update', Icon: Bell, tone: 'bg-ink-100 text-ink-600' },
}

/** The order chips appear in (only kinds the person actually has are shown). */
export const KIND_ORDER: KindKey[] = ['applications', 'renewals', 'hours', 'reports', 'stipend', 'concerns', 'announcements', 'other']

export const kindInfo = (key: KindKey): Kind => ({ key, ...KINDS[key] })

/** Which kind a notification belongs to (its `data.type`, plus renewal vs new for applications). */
export function kindOf(n: Notification): Kind {
  const d = n.data ?? ({} as Notification['data'])
  const type = String(d.type ?? '')
  let key: KindKey
  switch (type) {
    case 'application':
    case 'interview':
      key = d.kind === 'renewal' || /renewal/i.test(String(d.title ?? '')) ? 'renewals' : 'applications'
      break
    case 'attendance': case 'verification': case 'verification_reminder': case 'approval': case 'assignment':
      key = 'hours'; break
    case 'term_report': case 'term': case 'promissory':
      key = 'reports'; break
    case 'stipend': case 'signature':
      key = 'stipend'; break
    case 'concern':
      key = 'concerns'; break
    case 'announcement':
      key = 'announcements'; break
    default:
      key = 'other'
  }
  return kindInfo(key)
}

/** Interviews keep their own icon inside Applications. */
export const iconFor = (n: Notification, kind: Kind): LucideIcon =>
  n.data?.type === 'interview' ? CalendarClock : n.data?.type === 'verification_reminder' ? ClipboardList : kind.Icon

/**
 * "**Who** what": the person's name in bold when the message starts with it (new applications),
 * else the title in bold and the message as the rest.
 */
export function whoWhat(n: Notification): { who: string; what: string; inline: boolean } {
  const d = n.data ?? ({} as Notification['data'])
  const message = String(d.message ?? '')
  const name = (d.applicant_name ?? d.name ?? null) as string | null
  if (name && message.startsWith(name)) return { who: name, what: message.slice(name.length).trim(), inline: true }
  return { who: String(d.title ?? 'Notification'), what: message, inline: false }
}
