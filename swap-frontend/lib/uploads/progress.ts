/**
 * Every file upload in the portal goes through apiClient (lib/api/axios.ts), which reports its
 * progress here; <UploadProgress /> (mounted once in the root layout) shows it. A tiny store,
 * readable with useSyncExternalStore, so no page has to wire anything.
 */
export interface UploadState {
  id: number
  /** The first file's name, or "N files". */
  label: string
  loaded: number
  total: number
  startedAt: number
}

let uploads: UploadState[] = []
const listeners = new Set<() => void>()
let nextId = 1

const emit = () => listeners.forEach((l) => l())

export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getUploads = (): UploadState[] => uploads
const EMPTY: UploadState[] = []
export const getServerUploads = (): UploadState[] => EMPTY

/** What an upload is called: its file's name, or how many files. */
export function uploadLabel(form: FormData): string {
  const files = Array.from(form.values()).filter((v): v is File => typeof File !== 'undefined' && v instanceof File)
  if (files.length === 0) return 'your file'
  return files.length === 1 ? files[0].name : `${files.length} files`
}

export function startUpload(label: string, total: number): number {
  const id = nextId++
  uploads = [...uploads, { id, label, loaded: 0, total, startedAt: Date.now() }]
  emit()
  return id
}

export function progressUpload(id: number, loaded: number, total?: number): void {
  uploads = uploads.map((u) => (u.id === id ? { ...u, loaded, total: total || u.total } : u))
  emit()
}

export function endUpload(id: number | undefined): void {
  if (id == null) return
  uploads = uploads.filter((u) => u.id !== id)
  emit()
}
