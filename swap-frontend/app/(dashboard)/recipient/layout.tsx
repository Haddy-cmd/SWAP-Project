import type { ReactNode } from 'react'
import { MissingSignatureBanner } from '@/components/recipient/MissingSignatureBanner'

/** Recipient section shell: the missing-signature banner rides above every page. */
export default function RecipientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MissingSignatureBanner />
      {children}
    </>
  )
}
