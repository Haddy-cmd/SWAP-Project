'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatDate'
import type { Notification } from '@/types/notification.types'

/**
 * An announcement's full text, opened from the bell or the Notifications page. Rendered
 * into <body>: the top bar's backdrop blur would otherwise trap a fixed overlay inside it.
 */
export function AnnouncementModal({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const title = String(notification.data.title ?? '').replace(/^Announcement:\s*/i, '')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="announcement-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Announcement · DSA Office</p>
              <h2 id="announcement-title" className="mt-0.5 text-lg font-semibold text-ink-950">{title || 'Announcement'}</h2>
              <p className="text-xs text-ink-400">{formatDateTime(notification.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-350 hover:text-danger-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-800">{String(notification.data.message ?? '')}</p>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">Close</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
