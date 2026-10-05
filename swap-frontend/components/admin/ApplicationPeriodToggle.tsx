'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Unlock } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

/** Admin switch that opens or closes the student application period. */
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
    return <div className="h-[88px] animate-pulse rounded-2xl bg-ink-200/50" />
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${open ? 'bg-success-50' : 'bg-brand-100'}`}>
          {open ? <Unlock className="h-5 w-5 text-success-600" /> : <Lock className="h-5 w-5 text-brand-700" />}
        </div>
        <div>
          <p className="font-semibold text-ink-900">
            Application Period —{' '}
            <span className={open ? 'text-success-600' : 'text-brand-700'}>{open ? 'Open' : 'Closed'}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-500">
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
        onClick={() => flip(!open)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          open ? 'bg-success-600' : 'bg-ink-300'
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
