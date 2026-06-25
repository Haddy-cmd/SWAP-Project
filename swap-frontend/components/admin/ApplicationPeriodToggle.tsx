'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Unlock } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

/** Admin switch that opens or closes the student application period. */
export function ApplicationPeriodToggle() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsApi.getSettings(),
  })

  const update = useMutation({
    mutationFn: (open: boolean) => settingsApi.updateSettings({ applications_open: open }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['application-status'] })
    },
  })

  const open = settings?.applications_open ?? false

  if (isLoading) {
    return <div className="h-[88px] animate-pulse rounded-2xl bg-[#EAD9D9]/50" />
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${open ? 'bg-green-50' : 'bg-[#F3E3E3]'}`}>
          {open ? <Unlock className="h-5 w-5 text-[#27AE60]" /> : <Lock className="h-5 w-5 text-[#7D1A1A]" />}
        </div>
        <div>
          <p className="font-semibold text-[#1E293B]">
            Application Period —{' '}
            <span className={open ? 'text-[#27AE60]' : 'text-[#7D1A1A]'}>{open ? 'Open' : 'Closed'}</span>
          </p>
          <p className="mt-0.5 text-sm text-[#8A6A6A]">
            {open
              ? 'Students can submit new applications right now.'
              : 'Students see a "not yet open" notice and cannot apply.'}
          </p>
        </div>
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={open}
        disabled={update.isPending}
        onClick={() => update.mutate(!open)}
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
  )
}
