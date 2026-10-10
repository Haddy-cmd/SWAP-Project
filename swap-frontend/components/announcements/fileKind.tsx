import { File, FileSpreadsheet, FileText, Presentation, type LucideIcon } from 'lucide-react'

/** Icon and colours for an attached document, by its extension (photos are shown as thumbnails). */
export function fileKind(name: string): { Icon: LucideIcon; fg: string; bg: string } {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return { Icon: FileText, fg: '#A3201F', bg: '#F6E1E0' }
  if (ext === 'doc' || ext === 'docx') return { Icon: FileText, fg: '#2E5C8A', bg: '#E3ECF6' }
  if (ext === 'xls' || ext === 'xlsx') return { Icon: FileSpreadsheet, fg: '#0B5234', bg: '#DFF0E7' }
  if (ext === 'ppt' || ext === 'pptx') return { Icon: Presentation, fg: '#B5561F', bg: '#FBE7DA' }
  return { Icon: File, fg: '#5B6B62', bg: '#EEF0EC' }
}

export function fileSize(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
