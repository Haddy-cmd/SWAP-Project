'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

/** Single-open accordion; the first question starts open, as in the design. */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0)

  return (
    <div>
      {items.map((f, k) => {
        const isOpen = open === k
        return (
          <div key={f.q} className="border-t border-ink-200">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : k)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-5 py-6 text-left"
            >
              <span className="text-base font-semibold text-ink-950">{f.q}</span>
              {isOpen ? (
                <Minus className="h-5 w-5 flex-none text-brand-700" />
              ) : (
                <Plus className="h-5 w-5 flex-none text-brand-700" />
              )}
            </button>
            {isOpen && (
              <div className="pb-[26px] pr-10 text-[14.5px] leading-[1.7] text-ink-600 text-pretty">{f.a}</div>
            )}
          </div>
        )
      })}
      <div className="border-t border-ink-200" />
    </div>
  )
}
