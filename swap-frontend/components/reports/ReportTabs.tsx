'use client'

import type { LucideIcon } from 'lucide-react'

export interface ReportTab {
  key: string
  label: string
  icon: LucideIcon
}

/** The Overview + report tabs across the top of Analytics & Reports. */
export function ReportTabs({ tabs, active, onSelect }: { tabs: ReportTab[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-[13px] border border-ink-200 bg-white p-1 shadow-[0_2px_8px_rgba(19,36,26,0.04)]">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button key={t.key} role="tab" aria-selected={on} onClick={() => onSelect(t.key)}
            className={`flex flex-none items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors ${on ? 'bg-brand-700 text-white shadow-[0_6px_14px_rgba(22,69,43,.2)]' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}>
            <t.icon className={`h-4 w-4 ${on ? 'text-gold-300' : 'text-ink-400'}`} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
