'use client'

import { useState, type ReactNode } from 'react'
import { Check, Circle } from 'lucide-react'
import { PASSWORD_CHECKS } from '@/lib/utils/password'

/**
 * Wraps a new-password field: while it has focus, a small card under it lists the
 * requirements, ticked as they're met. It floats over the form, so nothing shifts,
 * and goes away when the field loses focus (the form's own error covers the rest).
 */
export function PasswordGuide({ value, children }: { value?: string; children: ReactNode }) {
  const [focused, setFocused] = useState(false)
  const password = value ?? ''

  return (
    <div className="relative" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {children}
      {focused && (
        <div role="status" className="absolute left-0 top-full z-20 mt-2 w-full max-w-xs rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
          <p className="mb-1.5 text-[11.5px] font-semibold text-ink-700">Your password needs</p>
          <ul className="space-y-1 text-[11.5px]">
            {PASSWORD_CHECKS.map((c) => {
              const ok = c.test(password)
              return (
                <li key={c.label} className={`flex items-center gap-1.5 ${ok ? 'text-success-700' : 'text-ink-500'}`}>
                  {ok ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : <Circle className="h-3 w-3 flex-shrink-0" />}
                  {c.label}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
