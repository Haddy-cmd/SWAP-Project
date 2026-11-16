'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * A thin gold bar at the top while the next page loads: it starts on a click of a link to
 * another page of the portal (the App Router keeps the old page up until the new one is
 * ready, which can take a moment) and finishes when the address changes.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const safety = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page (or only a #hash): nothing loads.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setPhase('loading')
      window.clearTimeout(safety.current)
      safety.current = window.setTimeout(() => setPhase('idle'), 10_000)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // The address changed: the new page is in — finish the bar, then hide it.
  useEffect(() => {
    window.clearTimeout(safety.current)
    setPhase((p) => (p === 'loading' ? 'done' : p))
    const t = window.setTimeout(() => setPhase((p) => (p === 'done' ? 'idle' : p)), 450)
    return () => window.clearTimeout(t)
  }, [pathname, search])

  if (phase === 'idle') return null
  return <div aria-hidden className={`nav-progress ${phase === 'done' ? 'is-done' : ''}`} />
}
