'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { getServerUploads, getUploads, subscribeUploads } from '@/lib/uploads/progress'

/** Quick uploads finish before this and show nothing (no flicker). */
const SHOW_AFTER_MS = 400

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

/**
 * Bottom-centre card while a file upload takes a moment, on every page: the file name, a bar
 * and the percentage, then "Processing…" once the file is sent and the server is saving it.
 * Fed by apiClient for every multipart request (lib/uploads/progress.ts).
 */
export function UploadProgress() {
  const uploads = useSyncExternalStore(subscribeUploads, getUploads, getServerUploads)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (uploads.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [uploads.length])

  const visible = uploads.filter((u) => now - u.startedAt >= SHOW_AFTER_MS)
  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[96] flex flex-col items-center gap-2 px-4 pb-safe" aria-live="polite">
      {visible.map((u) => {
        const pct = u.total > 0 ? Math.min(100, Math.round((u.loaded / u.total) * 100)) : 0
        const sent = u.total > 0 && u.loaded >= u.total
        return (
          <div key={u.id} role="status"
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-ink-200 bg-surface px-4 py-3 shadow-[0_12px_32px_rgba(19,36,26,.18)]">
            <div className="flex items-center gap-2.5">
              {sent ? <Loader2 className="h-4 w-4 flex-none animate-spin text-accent" /> : <UploadCloud className="h-4 w-4 flex-none text-accent" />}
              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-900">
                {sent ? 'Processing' : 'Uploading'} {u.label}…
              </p>
              <span className="flex-none text-xs font-bold tabular-nums text-ink-600">{sent ? '' : `${pct}%`}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${sent ? 100 : pct}%` }} />
            </div>
            {u.total > 0 && !sent && (
              <p className="mt-1 text-[11px] text-ink-400">{mb(u.loaded)} of {mb(u.total)} MB · keep this page open</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
