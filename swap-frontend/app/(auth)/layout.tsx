import type { ReactNode } from 'react'
import { Seal } from '@/components/shared/Seal'

const STATS = [
  { label: 'Recipients', value: '500+' },
  { label: 'Offices', value: '20+' },
  { label: 'Years', value: '10+' },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:px-12 font-serif"
        style={{ background: 'linear-gradient(150deg, #8E1B1B 0%, #5C1010 55%, #7A1717 100%)' }}
      >
        {/* soft gold glow accents */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#D8B65A]/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#D8B65A]/10 blur-2xl" />
        {/* gold corner frame */}
        <div className="pointer-events-none absolute inset-8 rounded-sm border border-[#D8B65A]/20" />

        <div className="relative max-w-md text-center">
          <div className="mx-auto mb-7 w-fit">
            <Seal size={104} />
          </div>
          <h1 className="text-4xl font-bold text-white">SWAP Portal</h1>
          <p className="mt-3 text-[11px] font-sans uppercase tracking-[0.22em] text-[#D8B65A]">
            Mindanao State University — Marawi
          </p>
          <div className="mx-auto mt-5 h-px w-20 bg-[#D8B65A]" />
          <p className="mt-6 font-sans text-sm leading-relaxed text-white/70">
            Digital monitoring and application system for the Student Welfare
            Assistantship Program.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-[#D8B65A]">{s.value}</p>
                <p className="mt-0.5 font-sans text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-8 font-sans text-[11px] text-white/40">
          Office of Student Affairs · swap@msumain.edu.ph
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F7F3EC] px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
