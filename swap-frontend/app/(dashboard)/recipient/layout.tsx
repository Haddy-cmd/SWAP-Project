import type { ReactNode } from 'react'
import { MissingSignatureBanner } from '@/components/recipient/MissingSignatureBanner'
import { FloatingShiftTimer } from '@/components/recipient/FloatingShiftTimer'

/**
 * Recipient section shell: the missing-signature banner rides above every page, and
 * while clocked in a draggable shift timer floats over every page but Attendance.
 */
export default function RecipientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MissingSignatureBanner />
      {children}
      <FloatingShiftTimer />
    </>
  )
}
