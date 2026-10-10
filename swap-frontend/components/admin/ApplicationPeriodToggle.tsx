'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/lib/api/settings.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

/** Admin switch that opens or closes the student application period: a small pill in the page header. */
export function ApplicationPeriodToggle() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsApi.getSettings(),
  })

  const { notify, notifyError, confirm } = useFeedback()
  const update = useMutation({
    mutationFn: (open: boolean) => settingsApi.updateSettings({ applications_open: open }),
    onSuccess: (_r, open) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['application-status'] })
      notify(open
        ? { title: 'Applications are now open', detail: 'Students can submit new applications.' }
        : { title: 'Applications are now closed', detail: 'Students see the "not yet open" notice.' })
    },
    onError: (e) => notifyError(e, 'Could not change the application period'),
  })
  const flip = async (open: boolean) => {
    const ok = await confirm(open
      ? { title: 'Open the application period?', body: 'Students (and former recipients) can submit new applications right away.', confirmLabel: 'Open applications' }
      : { title: 'Close the application period?', body: 'New applications are refused until you open it again. Applications already submitted are not affected.', confirmLabel: 'Close applications', tone: 'danger' })
    if (ok) update.mutate(open)
  }

  const open = settings?.applications_open ?? false

  if (isLoading) {
    return <div className="h-9 w-56 animate-pulse rounded-full bg-ink-200/50" />
  }

  return (
    <div
      title={open ? 'Students can submit new applications right now.' : 'Students see a "not yet open" notice and cannot apply.'}
      className="inline-flex flex-shrink-0 items-center gap-2.5 rounded-full border border-ink-200 bg-white py-1.5 pl-3 pr-1.5 shadow-sm"
    >
      <span className={`h-2 w-2 rounded-full ${open ? 'bg-success-600' : 'bg-ink-350'}`} aria-hidden />
      <span className={`text-[13px] font-semibold ${open ? 'text-success-700' : 'text-ink-600'}`}>
        Applications {open ? 'open' : 'closed'}
      </span>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={open}
        aria-label="Application period"
        disabled={update.isPending}
        onClick={() => flip(!open)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          open ? 'bg-success-600' : 'bg-ink-300'
        }`}
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${
            open ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
