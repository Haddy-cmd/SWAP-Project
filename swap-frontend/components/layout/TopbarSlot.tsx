'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** The id of the empty spot in the shared top bar, just left of the notification bell. */
export const TOPBAR_SLOT_ID = 'topbar-actions'

/**
 * Puts a page's own control into the shared top bar (e.g. the admin dashboard's semester
 * picker). Other pages leave the spot empty; leaving the page removes the control.
 */
export function TopbarSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById(TOPBAR_SLOT_ID))
  }, [])

  return target ? createPortal(children, target) : null
}
