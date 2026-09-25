'use client'

import { useUIStore } from '@/lib/store/uiStore'

/** Opens the floating chatbot widget (used in place of links to a separate chatbot page). */
export function AskChatbotButton({
  className,
  children,
  label,
}: {
  className?: string
  children: React.ReactNode
  /** Accessible name + tooltip, for icon-only buttons. */
  label?: string
}) {
  const setChatOpen = useUIStore((s) => s.setChatOpen)
  return (
    <button type="button" onClick={() => setChatOpen(true)} className={className} aria-label={label} title={label}>
      {children}
    </button>
  )
}
