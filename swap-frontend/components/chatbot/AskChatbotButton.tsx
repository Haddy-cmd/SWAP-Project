'use client'

import { useUIStore } from '@/lib/store/uiStore'

/** Opens the floating chatbot widget (used in place of links to a separate chatbot page). */
export function AskChatbotButton({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const setChatOpen = useUIStore((s) => s.setChatOpen)
  return (
    <button type="button" onClick={() => setChatOpen(true)} className={className}>
      {children}
    </button>
  )
}
