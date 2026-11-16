import type { ReactNode } from 'react'
import { MissingSignatureBanner } from '@/components/recipient/MissingSignatureBanner'
import { FloatingShiftTimer } from '@/components/recipient/FloatingShiftTimer'
import { PremisesCountdown, PremisesWatch } from '@/components/recipient/PremisesWatch'

/**
 * Recipient section shell: the missing-signature banner rides above every page, and
 * while clocked in a draggable shift timer floats over every page but Attendance. The
 * location is watched on every page while clocked in, and leaving the office shows the
 * auto clock-out countdown above the page.
 */
export default function RecipientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MissingSignatureBanner />
      <PremisesCountdown />
      {children}
      <FloatingShiftTimer />
      <PremisesWatch />
    </>
  )
}
