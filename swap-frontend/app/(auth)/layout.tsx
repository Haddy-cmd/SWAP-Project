'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

const STATS = [
  { label: 'Recipients', value: '500+' },
  { label: 'Offices', value: '20+' },
  { label: 'Years', value: '10+' },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Login and register render their own self-contained layouts, so they opt out
  // of the shared brand-left shell used by forgot-password / verify-email.
  if (pathname === '/login' || pathname === '/register') return <>{children}</>

  return (
    <div className="flex min-h-screen bg-[#F7F1EA]">
      {/* Left panel — branding over a veiled MSU campus photo (hidden on mobile). */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[44%] lg:flex-col lg:items-center lg:justify-center lg:px-12">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/campus.jpg)' }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, rgba(108,21,29,0.92) 0%, rgba(86,16,22,0.88) 55%, rgba(64,12,18,0.94) 100%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(50,10,16,0.45)]" />

        <div className="relative z-10 max-w-md text-center text-[#FBEFE0]">
          <div className="mx-auto mb-7">
            <Image src="/dsa-logo.png" alt="DSA Logo" width={96} height={96} className="mx-auto" priority />
          </div>
          <h1 className="font-serif text-4xl font-semibold text-[#FFF8EE]">SWAP Portal</h1>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E3B96E]">
            Mindanao State University — Marawi
          </p>
          <div className="mx-auto mt-6 h-px w-14 bg-[#F3D9A0]/50" />
          <p className="mt-6 text-sm leading-relaxed text-[#FBEFE0]/80">
            Digital monitoring and application system for the Student Welfare
            Assistantship Program.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-10 border-t border-[#F3D9A0]/25 pt-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-serif text-3xl font-semibold text-[#F3D9A0]">{s.value}</p>
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-[#FBEFE0]/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-8 z-10 text-[11px] text-[#FBEFE0]/55">
          Division of Students Affairs · dsa@msumain.edu.ph
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
