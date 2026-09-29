'use client'

import Link from 'next/link'
import { PenLine } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'

/**
 * Persistent nudge for recipients without a signature specimen: the stipend
 * release is refused until one is saved (it signs the claim stub). Reads the
 * auth store (refreshed on profile save), so it vanishes the moment they
 * upload — no endpoint, no polling.
 */
export function MissingSignatureBanner() {
  const { user } = useAuthStore()

  if (!user || user.role !== 'recipient' || user.signature_url) return null

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
      <PenLine className="h-4 w-4 flex-shrink-0" />
      {/* Matches the release refusal (StipendClaimService::MSG_NO_SIGNATURE), from the student's side. */}
      <p>
        A digital signature is required before your stipend can be released.{' '}
        <Link href="/profile" className="font-semibold underline">
          Draw or upload one on your Profile page.
        </Link>
      </p>
    </div>
  )
}
