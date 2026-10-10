'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const FLAG = 'swap_splash'
const HOLD_MS = 1100 // the seal stays this long before the veil lifts
const LIFT_MS = 350 // the slide-up
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/accept-invitation', '/verify-email']

/** Called on a successful sign-in in this tab: the next page opens behind the splash. */
export function markLoginSplash(): void {
  try { window.sessionStorage.setItem(FLAG, '1') } catch { /* no storage: no splash */ }
}

function takeFlag(): boolean {
  try {
    if (window.sessionStorage.getItem(FLAG) !== '1') return false
    window.sessionStorage.removeItem(FLAG)
    return true
  } catch {
    return false
  }
}

type Phase = 'hidden' | 'enter' | 'shown' | 'lift'

/**
 * After every sign-in (any role): a soft veil with the DSA seal fading in, held briefly, then the
 * veil slides up to reveal the first page — hiding its loading. Plays once per sign-in (a
 * sessionStorage flag set by the sign-in), never on refreshes or ordinary navigation. Reduced
 * motion: a short fade instead. A click skips it.
 */
export function LoginSplash() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [reduced, setReduced] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const finish = () => { clear(); setPhase('hidden') }

  useEffect(() => {
    if (!pathname || AUTH_PAGES.some((p) => pathname.startsWith(p)) || !takeFlag()) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    setReduced(calm)
    clear()
    setPhase('enter')
    const hold = calm ? 500 : HOLD_MS
    const lift = calm ? 400 : LIFT_MS
    timers.current = [
      setTimeout(() => setPhase('shown'), 60),
      setTimeout(() => setPhase('lift'), hold),
      setTimeout(() => setPhase('hidden'), hold + lift + 100),
    ]
  }, [pathname])

  useEffect(() => clear, [])

  if (phase === 'hidden') return null

  const lifted = phase === 'lift'
  return (
    <div
      aria-hidden
      onClick={finish}
      className="fixed inset-0 z-[1000] flex cursor-pointer items-center justify-center print:hidden"
      style={{
        background: 'rgba(246,246,239,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transform: !reduced && lifted ? 'translateY(-100%)' : 'translateY(0)',
        opacity: reduced && lifted ? 0 : 1,
        transition: reduced ? 'opacity .4s ease' : `transform ${LIFT_MS / 1000}s cubic-bezier(.7,0,.2,1)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dsa-logo.png"
        alt=""
        width={132}
        height={132}
        style={{
          width: 132,
          height: 'auto',
          opacity: phase === 'enter' ? 0 : 1,
          transform: !reduced && phase === 'enter' ? 'scale(.94)' : 'scale(1)',
          transition: 'opacity .5s ease, transform .6s ease',
        }}
      />
    </div>
  )
}
