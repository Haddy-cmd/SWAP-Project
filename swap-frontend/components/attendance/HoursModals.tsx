'use client'

import { useState } from 'react'
import { X, Plus, Target } from 'lucide-react'

const FIELD =
  'w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#B09A9A] focus:border-[#7D1A1A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15'

const today = () => new Date().toISOString().slice(0, 10)

function Shell({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-[#1E293B]">{title}</h2>
            {subtitle && <p className="text-sm text-[#8A6A6A]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[#B09A9A] hover:text-[#7D1A1A] transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Grant bonus / manual hours to a recipient. */
export function ManualHoursModal({ studentName, onClose, onSubmit, isPending, error, requiresApproval }: {
  studentName?: string
  onClose: () => void
  onSubmit: (v: { hours: number; date: string; reason: string }) => void
  isPending?: boolean
  error?: string | null
  requiresApproval?: boolean
}) {
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState('')
  const valid = Number(hours) > 0 && reason.trim().length > 0 && !!date

  const subtitle = requiresApproval
    ? `${studentName ? `For ${studentName}. ` : ''}Will be sent to the supervisor for approval.`
    : (studentName ? `For ${studentName} — counts as verified hours.` : 'Counts as verified hours.')

  return (
    <Shell title="Add Bonus Hours" subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Hours</label>
            <input type="number" min={0.25} max={24} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 5" className={FIELD} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Date</label>
            <input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Assisted at the university event off-system" className={`${FIELD} resize-none`} />
        </div>
        {error && <p className="text-xs text-[#E74C3C]">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={isPending} className="rounded-xl border border-[#EAD9D9] px-5 py-2.5 text-sm font-semibold text-[#8A6A6A] hover:bg-[#FAF7F7] disabled:opacity-50 transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit({ hours: Number(hours), date, reason: reason.trim() })}
            disabled={!valid || isPending}
            className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C1010] disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {isPending ? 'Sending…' : requiresApproval ? 'Send for Approval' : 'Add Hours'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

/** Adjust the hours a recipient is required to render. */
export function RequiredHoursModal({ current, onClose, onSubmit, isPending, error, requiresApproval }: {
  current: number
  onClose: () => void
  onSubmit: (hours: number) => void
  isPending?: boolean
  error?: string | null
  requiresApproval?: boolean
}) {
  const [value, setValue] = useState(String(current ?? ''))
  const valid = Number(value) >= 1

  const subtitle = requiresApproval
    ? 'The supervisor will be asked to approve this change.'
    : 'The total hours this student must render this semester.'

  return (
    <Shell title="Adjust Required Hours" subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">Required hours</label>
          <input type="number" min={1} max={2000} step={1} value={value} onChange={(e) => setValue(e.target.value)} className={FIELD} />
          <p className="mt-1 text-xs text-[#8A6A6A]">Currently {current}h.</p>
        </div>
        {error && <p className="text-xs text-[#E74C3C]">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={isPending} className="rounded-xl border border-[#EAD9D9] px-5 py-2.5 text-sm font-semibold text-[#8A6A6A] hover:bg-[#FAF7F7] disabled:opacity-50 transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit(Number(value))}
            disabled={!valid || isPending}
            className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C1010] disabled:opacity-50 transition-colors"
          >
            <Target className="h-4 w-4" />
            {isPending ? 'Sending…' : requiresApproval ? 'Send for Approval' : 'Save'}
          </button>
        </div>
      </div>
    </Shell>
  )
}
