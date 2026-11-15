'use client'

import { useEffect, useRef, useState } from 'react'

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Whole numbers with thousands separators ("1,234"). */
export const wholeNumber = (n: number) => Math.round(n).toLocaleString()

/**
 * A number that counts up when it scrolls into view, and glides from the old value
 * when it changes. `format` turns the in-between value into text (peso, "12.5h", "43%"),
 * so pass the raw number. Shows the final value at once under prefers-reduced-motion.
 */
export function CountUp({ value, format = wholeNumber, duration = 900, className = '' }: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  const current = useRef(shown)
  const seen = useRef(false)

  useEffect(() => {
    if (reducedMotion() || !Number.isFinite(value)) {
      current.current = value
      setShown(value)
      return
    }
    let raf = 0
    const run = () => {
      const from = current.current
      const start = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / duration)
        const next = from + (value - from) * (1 - Math.pow(1 - k, 3))
        current.current = next
        setShown(next)
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    // First time: wait until it is on screen, so numbers below the fold still count when reached.
    if (seen.current) {
      run()
      return () => cancelAnimationFrame(raf)
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      seen.current = true
      run()
      return () => cancelAnimationFrame(raf)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      seen.current = true
      observer.disconnect()
      run()
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, duration])

  return <span ref={ref} className={`tabular-nums ${className}`}>{format(shown)}</span>
}
