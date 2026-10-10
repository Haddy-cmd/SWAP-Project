'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { formatDay } from '@/lib/utils/semester'
import type { ApiRequestError } from '@/lib/api/axios'
import { CARD, fmtHrs } from './HoursCard'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

/** Bonus hours this term, and the form to give more (hours, the day of the work, a reason). */
export function BonusCard({ studentId, studentName, bonuses }: {
  studentId: number; studentName: string; bonuses: { id: number; hours: number; date: string; reason: string | null }[]
}) {
  const qc = useQueryClient()
  const { notify } = useFeedback()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const n = Number(amount)
  const ok = n >= 0.25 && n <= 24 && !!reason.trim() && !!date
  const add = useMutation({
    mutationFn: () => attendanceApi.addManualHours(studentId, { hours: n, date, reason: reason.trim() }),
    onSuccess: () => {
      notify({ title: `${fmtHrs(n)}h bonus given to ${studentName.split(' ')[0]}`, detail: 'Counted as verified hours.' })
      setOpen(false); setAmount(''); setReason(''); setDate(today())
      for (const key of ['student-summary', 'student-logs', 'supervisor-students']) qc.invalidateQueries({ queryKey: [key] })
    },
    onError: (e: ApiRequestError) => setError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not add the hours.'),
  })

  return (
    <section className={`${CARD} flex flex-col gap-3 px-5 py-[18px]`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-ink-950">Bonus hours</span>
        <button type="button" onClick={() => { setError(null); setOpen((o) => !o) }} aria-expanded={open}
          className="flex h-8 items-center gap-1 rounded-[9px] border border-ink-200 bg-surface px-2.5 text-[12px] font-semibold text-accent-strong hover:border-accent">
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? 'Close' : 'Give bonus'}
        </button>
      </div>

      {open && (
        <form className="flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent-tint p-3"
          onSubmit={(e) => { e.preventDefault(); if (ok) { setError(null); add.mutate() } }}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-2.5">
              <span className="text-[12.5px] font-semibold text-ink-600">Hours</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus
                className="w-12 border-none bg-transparent text-right text-[13px] font-bold text-ink-900 focus:outline-none" />
            </label>
            <label className="flex h-[34px] min-w-[150px] flex-1 items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-2.5">
              <span className="text-[12.5px] text-ink-500">On</span>
              <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-900 focus:outline-none" />
            </label>
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Reason, e.g. helped during enrollment week"
            className="h-9 rounded-[9px] border border-ink-200 bg-surface px-3 text-[13px] text-ink-900 placeholder-ink-400 focus:border-accent focus:outline-none" />
          {amount && (n < 0.25 || n > 24) && <p className="text-[11.5px] text-danger-700">Between 0.25 and 24 hours.</p>}
          {error && <p className="text-[12px] text-danger-700">{error}</p>}
          <button type="submit" disabled={!ok || add.isPending}
            className="h-[34px] self-end rounded-[9px] bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-50">
            {add.isPending ? 'Saving…' : 'Save bonus'}
          </button>
        </form>
      )}

      {bonuses.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">None given this term.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bonuses.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="font-extrabold text-violet-600">+{fmtHrs(b.hours)}h</span>
              <span className="min-w-0 flex-1 truncate text-ink-600" title={b.reason ?? ''}>{b.reason ?? 'Bonus hours'}</span>
              <span className="flex-none text-ink-400">{formatDay(b.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
