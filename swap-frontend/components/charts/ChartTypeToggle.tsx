'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import { AreaChart, BarChart3, BarChartHorizontal, LineChart, PieChart, type LucideIcon } from 'lucide-react'

export type ChartType = 'bar' | 'column' | 'line' | 'area' | 'pie'

const META: Record<ChartType, { label: string; Icon: LucideIcon }> = {
  bar: { label: 'Bars', Icon: BarChartHorizontal },
  column: { label: 'Columns', Icon: BarChart3 },
  line: { label: 'Line', Icon: LineChart },
  area: { label: 'Area', Icon: AreaChart },
  pie: { label: 'Pie', Icon: PieChart },
}

const storageKey = (key: string) => `swap-chart-type:${key}`

/**
 * The chart type a graph shows, remembered per graph in this browser. Storage can be
 * unavailable (private window, blocked site data): the graph then just starts on `fallback`.
 */
export function useChartType<T extends ChartType>(key: string, options: readonly T[], fallback: T): [T, (type: T) => void] {
  const [type, setType] = useState<T>(fallback)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(key)) as T | null
      if (saved && options.includes(saved)) setType(saved)
    } catch { /* no storage: keep the default */ }
    // `options` is a constant list per graph; re-read only when the key changes.
  }, [key])

  const choose = (next: T) => {
    setType(next)
    try { window.localStorage.setItem(storageKey(key), next) } catch { /* not remembered */ }
  }

  return [type, choose]
}

interface Props<T extends ChartType> {
  value: T
  options: readonly T[]
  onChange: (type: T) => void
  /** Names the graph for screen readers, e.g. "Office Distribution". */
  label: string
}

/** A small segmented control above a graph: one icon button per chart type. */
export function ChartTypeToggle<T extends ChartType>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="group" aria-label={`${label} chart type`} className="inline-flex flex-shrink-0 rounded-lg border border-ink-200 bg-ink-50 p-0.5">
      {options.map((option) => {
        const { label: name, Icon } = META[option]
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={active}
            onClick={(e: MouseEvent) => {
              // Some graphs sit inside a link card: switching type must not navigate.
              e.preventDefault()
              e.stopPropagation()
              onChange(option)
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-400 hover:text-ink-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

/**
 * The labelled variant (icon + word, e.g. "Bars | Line") used on the admin dashboard: a pale
 * track with the chosen option raised in white.
 */
export function SegmentedToggle<T extends string>({ value, options, onChange, label }: {
  value: T
  options: readonly { value: T; label: string; Icon: LucideIcon }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={`${label} view`} className="inline-flex flex-shrink-0 gap-0.5 rounded-[10px] bg-ink-100/70 p-[3px]">
      {options.map(({ value: v, label: name, Icon }) => {
        const active = v === value
        return (
          <button key={v} type="button" aria-pressed={active}
            onClick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); onChange(v) }}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              active ? 'bg-white text-ink-950 shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-500 hover:text-ink-800'}`}>
            <Icon className="h-3.5 w-3.5" /> {name}
          </button>
        )
      })}
    </div>
  )
}
