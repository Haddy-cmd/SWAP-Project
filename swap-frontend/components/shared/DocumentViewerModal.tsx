'use client'

import { useEffect } from 'react'
import { X, ExternalLink, Download, FileText } from 'lucide-react'

export interface ViewableDocument {
  file_url: string
  file_name?: string | null
  mime_type?: string | null
  document_type?: string | null
}

/**
 * Lightbox-style document preview. Renders images and PDFs inline on the current
 * page instead of opening a new browser tab. Falls back to an "open in new tab"
 * prompt for types the browser can't embed.
 */
export function DocumentViewerModal({ doc, onClose }: { doc: ViewableDocument; onClose: () => void }) {
  const isImage = (doc.mime_type ?? '').startsWith('image/')
  const isPdf = doc.mime_type === 'application/pdf'
  const title = (doc.document_type ?? doc.file_name ?? 'Document').replace(/_/g, ' ')

  // Close on Escape, and lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EADFD4] px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize text-[#241715]">{title}</p>
            {doc.file_name && <p className="truncate text-xs text-[#A38A82]">{doc.file_name}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EADFD4] text-[#7C1B26] hover:bg-[#FBF7F2] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={doc.file_url}
              download={doc.file_name ?? true}
              title="Download"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EADFD4] text-[#7C1B26] hover:bg-[#FBF7F2] transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A38A82] hover:bg-[#FBF7F2] hover:text-[#7C1B26] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-[#F1F5F9]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.file_url} alt={title} className="max-h-[80vh] max-w-full object-contain" />
          ) : isPdf ? (
            <iframe src={doc.file_url} title={title} className="h-[80vh] w-full border-0" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="h-12 w-12 text-[#CBB9AC]" />
              <p className="text-sm text-[#64748B]">This file type can&apos;t be previewed here.</p>
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C1B26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#86202E] transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
