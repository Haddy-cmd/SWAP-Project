import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:px-12"
        style={{ background: 'linear-gradient(160deg, #8B1A1A 0%, #5C1010 100%)' }}
      >
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <span className="text-3xl font-black text-white">SW</span>
          </div>
          <h1 className="text-3xl font-bold text-white">SWAP Portal</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Digital Monitoring and Application System for the Student Welfare
            Assistantship Program at Mindanao State University — Marawi
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/20 pt-10">
            {[
              { label: 'Recipients', value: '500+' },
              { label: 'Offices', value: '20+' },
              { label: 'Years', value: '10+' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#FAF7F7] px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
