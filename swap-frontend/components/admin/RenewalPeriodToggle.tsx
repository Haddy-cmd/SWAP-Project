'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

const YEARS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

/**
 * Admin switch for the semester-renewal window: pick the target term, then open
 * it so returning recipients can submit their updated COR.
 */
export function RenewalPeriodToggle() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsApi.getSettings(),
  })

  const update = useMutation({
    mutationFn: (data: Partial<{ renewal_open: boolean; renewal_year: string; renewal_semester: string }>) =>
      settingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['application-status'] })
    },
  })

  const open = settings?.renewal_open ?? false
  const year = settings?.renewal_year ?? ''
  const semester = settings?.renewal_semester ?? ''
  const configured = !!year && !!semester

  if (isLoading) {
    return <div className="h-[88px] animate-pulse rounded-2xl bg-[#EAD9D9]/50" />
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${open ? 'bg-green-50' : 'bg-[#F1ECF7]'}`}>
          <RefreshCw className={`h-5 w-5 ${open ? 'text-[#27AE60]' : 'text-[#6B4E9A]'}`} />
        </div>
        <div>
          <p className="font-semibold text-[#1E293B]">
            Renewal Period —{' '}
            <span className={open ? 'text-[#27AE60]' : 'text-[#6B4E9A]'}>{open ? 'Open' : 'Closed'}</span>
          </p>
          <p className="mt-0.5 text-sm text-[#8A6A6A]">
            {open
              ? `Returning recipients can submit an updated COR for ${year} — ${semester}.`
              : 'Pick the target term, then open the window so recipients can renew.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={year}
          onChange={(e) => e.target.value && update.mutate({ renewal_year: e.target.value })}
          disabled={update.isPending}
          className="h-10 rounded-lg border border-[#EAD9D9] bg-[#FAF7F7] px-3 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none disabled:opacity-60"
        >
          <option value="">Academic year…</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={semester}
          onChange={(e) => e.target.value && update.mutate({ renewal_semester: e.target.value })}
          disabled={update.isPending}
          className="h-10 rounded-lg border border-[#EAD9D9] bg-[#FAF7F7] px-3 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none disabled:opacity-60"
        >
          <option value="">Semester…</option>
          {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          type="button"
          role="switch"
          aria-checked={open}
          disabled={update.isPending || (!open && !configured)}
          title={!open && !configured ? 'Set the academic year and semester first' : undefined}
          onClick={() => update.mutate({ renewal_open: !open })}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            open ? 'bg-[#27AE60]' : 'bg-[#D1C4C4]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              open ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
