'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { THEME_EVENT, applyTheme, getChoice, setChoice, type ThemeChoice } from '@/lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

/** Keeps the page in step with the choice: other tabs, and the device setting while on System. */
export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setState] = useState<ThemeChoice>('system')

  useEffect(() => {
    setState(getChoice())
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSystem = () => { if (getChoice() === 'system') applyTheme('system') }
    const onChange = () => setState(getChoice())
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === 'swap-theme') { applyTheme(); onChange() } }
    media?.addEventListener?.('change', onSystem)
    window.addEventListener(THEME_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media?.removeEventListener?.('change', onSystem)
      window.removeEventListener(THEME_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return [choice, (c) => { setChoice(c); setState(c) }]
}

/**
 * The theme button (top bar, sign-in and landing headers): Light · Dark · System.
 * `tone="onDark"` for placing it on the green headers.
 */
export function ThemeToggle({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  const [choice, choose] = useThemeChoice()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const Current = OPTIONS.find((o) => o.value === choice)?.Icon ?? Monitor

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Theme: ${choice}`} title="Theme"
        className={tone === 'onDark'
          ? 'flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/20 text-white/85 transition-colors hover:bg-white/10 hover:text-white'
          : 'flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-ink-900/15 bg-surface text-ink-700 transition-colors hover:bg-ink-50'}>
        <Current className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 w-40 overflow-hidden rounded-xl border border-ink-200 bg-surface p-1 shadow-[0_10px_30px_rgba(0,0,0,.18)]">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button key={value} type="button" role="menuitemradio" aria-checked={choice === value}
              onClick={() => { choose(value); setOpen(false) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-800 hover:bg-ink-50">
              <Icon className="h-4 w-4 text-ink-500" />
              <span className="flex-1">{label}</span>
              {choice === value && <Check className="h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Profile → Appearance: the same choice as the top-bar button, as three buttons. */
export function ThemeSetting() {
  const [choice, choose] = useThemeChoice()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1 rounded-xl bg-ink-100 p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} onClick={() => choose(value)}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
            choice === value ? 'bg-surface text-ink-950 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  )
}
