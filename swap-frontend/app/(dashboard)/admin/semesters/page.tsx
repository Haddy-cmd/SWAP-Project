'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Plus, Pencil, Trash2, RefreshCw, X, Lock } from 'lucide-react'
import { semestersApi } from '@/lib/api/semesters.api'
import { PHASE_STYLE, daysLeftText, periodRange } from '@/lib/utils/semester'
import { SEMESTERS, type SemesterPeriod, type SemesterPeriodInput } from '@/types/semester.types'
import type { ApiRequestError } from '@/lib/api/axios'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

const EMPTY: SemesterPeriodInput = { academic_year: '', semester: '1st Semester', start_date: '', end_date: '', renewal_open: false }

const toInput = (p: SemesterPeriod): SemesterPeriodInput => ({
  academic_year: p.academic_year, semester: p.semester, start_date: p.start_date, end_date: p.end_date, renewal_open: p.renewal_open,
})

/**
 * Admin → Semesters: the DSA calendar. Pace, the promissory window, the end-of-term
 * check and renewal all read these dates; an assignment's own end date only overrides
 * its term. Renewal is opened here, for one semester at a time.
 */
export default function AdminSemestersPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<SemesterPeriodInput>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { notify, notifyError, confirm } = useFeedback()

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['semester-periods'],
    queryFn: () => semestersApi.list(),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['semester-periods'] })
    qc.invalidateQueries({ queryKey: ['semester-current'] })
    qc.invalidateQueries({ queryKey: ['application-status'] })
  }

  const close = () => { setEditing(null); setForm(EMPTY); setErrors({}); setFormError(null) }

  const save = useMutation({
    mutationFn: () => (editing === 'new' || editing === null
      ? semestersApi.create(form)
      : semestersApi.update(editing, form)),
    onSuccess: (res) => { refresh(); close(); notify({ title: 'Semester saved', detail: res.message }) },
    onError: (e: ApiRequestError) => {
      setErrors(e.errors ?? {})
      setFormError(Object.keys(e.errors ?? {}).length ? null : (e.message ?? 'Could not save the semester.'))
    },
  })

  // One-click renewal switch on a row (sends the row's own dates back unchanged).
  const toggleRenewal = useMutation({
    mutationFn: (p: SemesterPeriod) => semestersApi.update(p.id, { ...toInput(p), renewal_open: !p.renewal_open }),
    onSuccess: (res) => {
      refresh()
      notify(res.data.renewal_open
        ? { title: 'Renewal opened', detail: `Recipients can now submit their renewal for ${res.data.label}.` }
        : { title: 'Renewal closed', detail: `Renewal for ${res.data.label} is closed.` })
    },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not change renewal'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => semestersApi.remove(id),
    onSuccess: (res) => { refresh(); setDeletingId(null); notify({ title: 'Semester deleted', detail: res.message }) },
    onError: (e: ApiRequestError) => { setDeletingId(null); notifyError(e, 'Could not delete the semester') },
  })

  const set = <K extends keyof SemesterPeriodInput>(key: K, value: SemesterPeriodInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: [] }))
  }

  const fieldError = (key: keyof SemesterPeriodInput) => errors[key]?.[0]
  // The semester being edited: what it may still change.
  const editingPeriod = typeof editing === 'number' ? periods.find((p) => p.id === editing) : undefined
  const renameLocked = !!editingPeriod?.locked?.rename
  const datesLocked = !!editingPeriod?.locked?.dates
  const ready = /^\d{4}-\d{4}$/.test(form.academic_year) && !!form.start_date && !!form.end_date
  const openRenewal = periods.find((p) => p.renewal_open)
  // Same rule as SaveSemesterPeriodRequest::msgRenewalTaken: one semester at a time.
  const renewalTaken = (id: number | 'new' | null) =>
    openRenewal && openRenewal.id !== id ? `Close renewal for ${openRenewal.label} first — only one semester can have renewal open at a time.` : null
  const formRenewalBlocked = renewalTaken(editing)

  const formCard = (
    <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">{editing === 'new' ? 'Add a semester' : 'Edit semester'}</h2>
        <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink-700">School year</span>
          <input value={form.academic_year} onChange={(e) => set('academic_year', e.target.value.trim())} placeholder="e.g. 2026-2027"
            maxLength={9} disabled={renameLocked} className={`${INPUT} mt-1 disabled:opacity-60`} />
          {fieldError('academic_year') && <span className="mt-1 block text-xs text-danger-700">{fieldError('academic_year')}</span>}
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-700">Semester</span>
          <select value={form.semester} onChange={(e) => set('semester', e.target.value)} disabled={renameLocked} className={`${INPUT} mt-1 disabled:opacity-60`}>
            {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {fieldError('semester') && <span className="mt-1 block text-xs text-danger-700">{fieldError('semester')}</span>}
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-700">First day</span>
          <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} disabled={datesLocked} className={`${INPUT} mt-1 disabled:opacity-60`} />
          {fieldError('start_date') && <span className="mt-1 block text-xs text-danger-700">{fieldError('start_date')}</span>}
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-700">Last day</span>
          <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} disabled={datesLocked} className={`${INPUT} mt-1 disabled:opacity-60`} />
          {fieldError('end_date') && <span className="mt-1 block text-xs text-danger-700">{fieldError('end_date')}</span>}
        </label>
      </div>

      {(renameLocked || datesLocked) && (
        <div className="mt-3 space-y-1 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
          {renameLocked && (
            <p className="flex items-start gap-1.5"><Lock className="mt-0.5 h-3.5 w-3.5 flex-none" />
              Students are already placed in this semester, so its school year and semester can&apos;t change. Add a new semester instead.</p>
          )}
          {datesLocked && (
            <p className="flex items-start gap-1.5"><Lock className="mt-0.5 h-3.5 w-3.5 flex-none" />
              This semester has been closed and its results recorded, so its dates can&apos;t change.</p>
          )}
        </div>
      )}

      <label className={`mt-4 flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3 ${formRenewalBlocked && !form.renewal_open ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={form.renewal_open} onChange={(e) => set('renewal_open', e.target.checked)}
          disabled={!!formRenewalBlocked && !form.renewal_open}
          className="mt-0.5 h-4 w-4 accent-brand-700" />
        <span>
          <span className="block text-sm font-semibold text-ink-900">Open renewal for this semester</span>
          <span className="block text-xs text-ink-500">
            {formRenewalBlocked ?? 'Returning recipients can submit their updated COR for this term. Only one semester can have renewal open at a time.'}
          </span>
        </span>
      </label>
      {fieldError('renewal_open') && <p className="mt-1 text-xs text-danger-700">{fieldError('renewal_open')}</p>}

      {formError && <p className="mt-3 text-sm text-danger-700">{formError}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={() => save.mutate()} disabled={!ready || save.isPending}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save semester'}
        </button>
        <button onClick={close} disabled={save.isPending}
          className="rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Semesters</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            The DSA calendar. Duty-hour pace, the promissory note window, the end-of-semester check and renewal all
            follow these dates. Renewal is opened here, for one semester at a time.
          </p>
        </div>
        {editing === null && (
          <button onClick={() => { setForm(EMPTY); setEditing('new') }}
            className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Add semester
          </button>
        )}
      </div>

      {editing === 'new' && formCard}

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">All semesters</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">{[1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-200" />)}</div>
        ) : !periods.length ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">No semesters set up yet</p>
            <p className="mt-1 text-sm text-ink-400">Add the current semester so pace, promissory notes and renewal know the term dates.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {periods.map((p) => {
              const phase = PHASE_STYLE[p.phase]
              if (editing === p.id) return <li key={p.id} className="p-4">{formCard}</li>
              return (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink-900">{p.label}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${phase.className}`}>{phase.label}</span>
                        {p.renewal_open && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                            <RefreshCw className="h-3 w-3" /> Renewal open
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-500">
                        {periodRange(p)}
                        {p.phase === 'current' && <span className="font-medium text-success-700"> · {daysLeftText(p.days_left)}</span>}
                      </p>
                      {p.usage && (
                        <p className="mt-0.5 text-xs text-ink-400">
                          {p.usage.assignments || p.usage.applications
                            ? `Used by ${p.usage.assignments} placement${p.usage.assignments === 1 ? '' : 's'} · ${p.usage.applications} application${p.usage.applications === 1 ? '' : 's'}`
                            : 'Not used yet'}
                          {p.closed_at ? ' · Closed, results recorded' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.phase !== 'ended' && (
                        <button onClick={async () => {
                          // Closing ends submissions, and with them the promissory window of the term before.
                          if (p.renewal_open && !(await confirm({
                            title: `Close renewal for ${p.label}?`,
                            body: 'Recipients can no longer submit a renewal for it, and promissory notes for the term before it close too.',
                            confirmLabel: 'Close renewal',
                            tone: 'danger',
                          }))) return
                          toggleRenewal.mutate(p)
                        }}
                          disabled={toggleRenewal.isPending || (!p.renewal_open && !!renewalTaken(p.id))}
                          title={!p.renewal_open ? renewalTaken(p.id) ?? undefined : undefined}
                          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50">
                          {p.renewal_open ? 'Close renewal' : 'Open renewal'}
                        </button>
                      )}
                      <button onClick={() => { setErrors({}); setFormError(null); setForm(toInput(p)); setEditing(p.id) }}
                        title="Edit" aria-label={`Edit ${p.label}`}
                        className="rounded-lg border border-ink-200 p-1.5 text-ink-600 hover:bg-ink-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {p.locked?.delete ? (
                        // Placements and applications link to this term: it stays (edit dates instead).
                        <span title="Students or applications use this semester, so it can't be deleted. Edit its dates instead."
                          aria-label={`${p.label} can't be deleted`}
                          className="rounded-lg border border-ink-200 p-1.5 text-ink-350">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : deletingId !== p.id && (
                        <button onClick={() => setDeletingId(p.id)} title="Delete" aria-label={`Delete ${p.label}`}
                          className="rounded-lg border border-ink-200 p-1.5 text-danger-700 hover:bg-danger-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {deletingId === p.id && (
                    <div className="mt-2 rounded-xl border border-danger-200 bg-danger-50 p-3">
                      <p className="text-sm text-danger-700">
                        Delete {p.label}? This only works while no assignments or applications use the semester.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => remove.mutate(p.id)} disabled={remove.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-danger-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" /> {remove.isPending ? 'Deleting…' : 'Yes, delete it'}
                        </button>
                        <button onClick={() => setDeletingId(null)} disabled={remove.isPending}
                          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'
