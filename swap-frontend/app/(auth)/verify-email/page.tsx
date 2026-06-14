'use client'

import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-8 shadow-sm text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF0F0]">
        <MailCheck className="h-8 w-8 text-[#7D1A1A]" />
      </div>
      <h2 className="text-2xl font-bold text-[#1E293B]">Verify your email</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#8A6A6A]">
        We sent a verification link to your registered email address.
        Please click the link to activate your account before signing in.
      </p>
      <p className="mt-2 text-sm text-[#8A6A6A]">
        Didn&apos;t receive it? Check your spam folder or contact the SWAP office.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
      >
        Back to Sign In
      </Link>
    </div>
  )
}
