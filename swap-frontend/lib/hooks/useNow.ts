'use client'

import { useEffect, useState } from 'react'

/** The current time, refreshed every `everyMs` (default one minute) for "… ago" labels. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
