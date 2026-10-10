'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const SEEN = 'swap_sidebar_hint_seen'

const seen = () => { try { return window.localStorage.getItem(SEEN) === '1' } catch { return true } }
const markSeen = () => { try { window.localStorage.setItem(SEEN, '1') } catch { /* not remembered */ } }

/**
 * One-time tip under the ☰ button the first time the desktop sidebar is hidden: where the menu
 * went and how to get it back. "Got it" (or pinning the sidebar) remembers it in this browser.
 */
export function SidebarHint({ hidden }: { hidden: boolean }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!hidden) {
      // Pinning the sidebar means they found it.
      if (show) { markSeen(); setShow(false) }
      return
    }
    if (!seen()) setShow(true)
  }, [hidden]) // eslint-disable-line

  if (!show) return null

  const dismiss = () => { markSeen(); setShow(false) }

  return (
    <div role="status"
      className="fixed left-4 top-[70px] z-40 hidden w-[280px] rounded-xl border border-brand-200 bg-white p-3.5 shadow-[0_10px_30px_rgba(19,36,26,.18)] md:block md:left-7 print:hidden">
      {/* Arrow pointing up at the ☰ button */}
      <span className="absolute -top-[7px] left-4 h-3.5 w-3.5 rotate-45 border-l border-t border-brand-200 bg-white" aria-hidden />
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Menu className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink-900">Your menu is here</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-500">
            Click the small › tab on the left edge or ☰ to open it, or hover the left edge to peek.
          </p>
          <button onClick={dismiss} className="mt-2 rounded-lg bg-brand-700 px-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-600">Got it</button>
        </div>
        <button onClick={dismiss} aria-label="Dismiss tip" className="rounded p-0.5 text-ink-400 hover:text-ink-700"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}
