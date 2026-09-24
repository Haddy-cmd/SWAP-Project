'use client'

import Link from 'next/link'
import { PenLine } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'

/**
 * Persistent nudge for recipients without a signature specimen: clock-in is
 * blocked and receipts fall back to typed until one is saved. Reads the auth
 * store (refreshed on profile save), so it vanishes the moment they upload —
 * no endpoint, no polling.
 */
export function MissingSignatureBanner() {
  const { user } = useAuthStore()

  if (!user || user.role !== 'recipient' || user.signature_url) return null

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[#F6E0BE] bg-[#FFF7ED] px-4 py-3 text-sm text-[#92400E]">
      <PenLine className="h-4 w-4 flex-shrink-0" />
      <p>
        Clock-in and receipts need your digital signature.{' '}
        <Link href="/profile" className="font-semibold underline">
          Draw or upload it on your Profile page →
        </Link>
      </p>
    </div>
  )
}
