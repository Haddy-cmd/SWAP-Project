'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { FILTERS, filterSections, type FilterKey, type GroupKey, type Row } from './rows'

/** "Show students who… (match any)": checkboxes with counts over the current group and search. */
export function FiltersPopover({ group, base, active, onToggle, onClear, onClose, shown }: {
  group: GroupKey
  base: Row[]
  active: Set<FilterKey>
  onToggle: (k: FilterKey) => void
  onClear: () => void
  onClose: () => void
  shown: number
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-filters-button]')) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [onClose])

  return (
    <div ref={box} role="dialog" aria-label="Filters"
      className="absolute right-4 top-[54px] z-30 w-[300px] max-w-[calc(100%-32px)] overflow-hidden rounded-[14px] border border-ink-200 bg-surface shadow-[0_14px_36px_rgba(20,40,30,.16)]">
      <div className="flex items-center justify-between border-b border-ink-900/[.06] px-3.5 py-3">
        <span className="text-[13.5px] font-bold text-ink-950">Show students who…</span>
        <span className="text-[11.5px] text-ink-400">match any</span>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {filterSections(group).map((sec) => (
          <div key={sec.title} className="px-3.5 pb-1 pt-2.5">
            <div className="mb-1 text-[11px] font-extrabold tracking-[0.08em] text-ink-400">{sec.title}</div>
            {sec.keys.map((k) => {
              const on = active.has(k)
              return (
                <button key={k} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(k)}
                  className="flex w-full items-center gap-2.5 px-1 py-[7px] text-left">
                  <span className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-2 ${
                    on ? 'border-accent bg-accent text-white' : 'border-ink-300 bg-surface'}`}>
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 text-[13px] text-ink-900">{FILTERS[k].label}</span>
                  <span className="text-[12px] font-bold text-ink-500">{base.filter(FILTERS[k].test).length}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 border-t border-ink-900/[.06] bg-ink-50 px-3.5 py-2.5">
        <button type="button" onClick={onClear} className="h-[34px] rounded-[9px] px-3 text-[12.5px] font-semibold text-ink-600 hover:bg-surface">Clear all</button>
        <button type="button" onClick={onClose} className="h-[34px] rounded-[9px] bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover">Show {shown}</button>
      </div>
    </div>
  )
}
