import { File, FileSpreadsheet, FileText, Presentation, type LucideIcon } from 'lucide-react'

/** Icon and colours for an attached document, by its extension (photos are shown as thumbnails). */
export function fileKind(name: string): { Icon: LucideIcon; fg: string; bg: string } {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return { Icon: FileText, fg: 'var(--text-red-strong)', bg: 'var(--color-danger-100)' }
  if (ext === 'doc' || ext === 'docx') return { Icon: FileText, fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' }
  if (ext === 'xls' || ext === 'xlsx') return { Icon: FileSpreadsheet, fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' }
  if (ext === 'ppt' || ext === 'pptx') return { Icon: Presentation, fg: 'var(--text-warning-700)', bg: 'var(--color-warning-100)' }
  return { Icon: File, fg: 'var(--text-ink-600)', bg: 'var(--color-surface-3)' }
}

export function fileSize(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
