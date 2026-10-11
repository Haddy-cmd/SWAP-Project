'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { VerifyEmailCode } from '@/components/auth/VerifyEmailCode'

function VerifyEmailInner() {
  const email = useSearchParams().get('email')
  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm sm:p-8">
      <VerifyEmailCode email={email} />
    </div>
  )
}

/** Enter the 6-digit code from the registration email (`?email=` prefills the address). */
export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-[420px] animate-pulse rounded-2xl bg-ink-100" />}>
      <VerifyEmailInner />
    </Suspense>
  )
}
