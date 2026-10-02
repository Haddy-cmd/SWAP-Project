'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, UserRound, Clock, CalendarX, Gavel, AlarmClock, FileText, Star, RefreshCw, RotateCcw, Search, UserPlus,
  UserMinus, Undo2, CheckCheck, LogIn, LogOut, FileSignature,
} from 'lucide-react'
import { testingApi } from '@/lib/api/testing.api'
import { TermBadge } from '@/components/shared/TermBadge'
import { formatDay } from '@/lib/utils/semester'
import type { ApiRequestError } from '@/lib/api/axios'
import { TESTING_OFF_MESSAGE, type TestingAccount, type TestingAction, type TestingStatus } from '@/types/testing.types'

const errorText = (e: ApiRequestError, fallback: string) => Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? fallback

type Note = { text: string; error?: boolean } | null
type WithStatus = { data: TestingStatus; message: string }

/**
 * Admin → System Testing: pick existing recipients/applicants and use shortcuts that move
 * their data into the state a test needs (end a term now, add hours, overdue makeup…), so
 * time-gated flows can be tried without waiting. What the shortcuts change is recorded
 * and can be undone on removal. Switched on and off here; picking, the relaxed rules and
 * the shortcuts only work while on.
 */
export default function SystemTestingPage() {
  const qc = useQueryClient()
  const [note, setNote] = useState<Note>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const { data, isLoading, isError } = useQuery({ queryKey: ['testing-status'], queryFn: testingApi.status, retry: false })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['testing-status'] })
    qc.invalidateQueries({ queryKey: ['testing-candidates'] })
    qc.invalidateQueries({ queryKey: ['admin-applications'] })
    qc.invalidateQueries({ queryKey: ['admin-assignments'] })
  }
  // Calls that return the refreshed status: show it right away, then refresh the rest.
  const applied = (res: WithStatus) => {
    qc.setQueryData<TestingStatus>(['testing-status'], res.data)
    refresh()
    setNote({ text: res.message })
  }

  const toggle = useMutation({
    mutationFn: (on: boolean) => testingApi.setEnabled(on),
    onSuccess: (res) => { qc.setQueryData<TestingStatus>(['testing-status'], res.data); setNote({ text: res.message }) },
    onError: (e: ApiRequestError) => setNote({ text: errorText(e, 'Could not change the switch.'), error: true }),
  })
  const releaseAll = useMutation({
    mutationFn: () => testingApi.releaseAll(),
    onSuccess: (res) => { setConfirmAll(false); applied(res) },
    onError: (e: ApiRequestError) => { setConfirmAll(false); setNote({ text: errorText(e, 'Could not remove the accounts.'), error: true }) },
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-ink-200" />
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center">
        <FlaskConical className="mx-auto h-8 w-8 text-ink-300" />
        <p className="mt-2 font-semibold text-ink-900">Could not load System Testing</p>
        <p className="mt-1 text-sm text-ink-500">Refresh the page to try again.</p>
      </div>
    )
  }

  const on = data.enabled
  const recipients = data.accounts.filter((a) => a.role === 'recipient')
  const applicants = data.accounts.filter((a) => a.role === 'applicant')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-brand-700" />
          <h1 className="text-2xl font-bold text-ink-900">System Testing</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Pick existing recipients or applicants and use shortcuts to try flows without waiting — end a term now, add hours, make a
          makeup overdue. While on, picked accounts may also clock in any day, any hour, from anywhere and without a selfie, and their
          interviews can be scheduled at any time. They keep their real email, so notifications can be tested too.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-900">
            System Testing — <span className={on ? 'text-success-600' : 'text-ink-500'}>{on ? 'On' : 'Off'}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-500">
            {on
              ? 'The shortcuts and the relaxed clock-in and interview rules work for picked accounts. Switch it off when you are done.'
              : 'Every account follows the normal rules. Nothing is undone while it is off; you can still remove picked accounts.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="System Testing"
          disabled={toggle.isPending}
          onClick={() => { setNote(null); toggle.mutate(!on) }}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-success-600' : 'bg-ink-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <ExistingPicker enabled={on} onAdded={applied} />

      {note && <p className={`text-sm font-medium ${note.error ? 'text-danger-700' : 'text-success-700'}`}>{note.text}</p>}

      {!data.accounts.length ? (
        <p className="rounded-2xl border border-dashed border-ink-300 bg-white px-5 py-10 text-center text-sm text-ink-500">
          No account in testing yet. Pick one above to start.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink-900">In testing ({data.accounts.length})</h2>
            {!confirmAll ? (
              <button onClick={() => { setNote(null); setConfirmAll(true) }}
                className="flex items-center gap-1.5 rounded-xl border border-danger-200 px-3.5 py-2 text-xs font-semibold text-danger-700 hover:bg-danger-50">
                <Undo2 className="h-3.5 w-3.5" /> Remove all and undo
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                Undo every account&apos;s recorded changes and remove them all from testing?
                <button onClick={() => releaseAll.mutate()} disabled={releaseAll.isPending} className="rounded-lg bg-danger-700 px-2.5 py-1 font-semibold text-white">
                  {releaseAll.isPending ? 'Removing…' : 'Yes, undo all'}
                </button>
                <button onClick={() => setConfirmAll(false)} className="font-semibold">Cancel</button>
              </span>
            )}
          </div>

          {applicants.length > 0 && (
            <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
              <h3 className="border-b border-ink-100 px-5 py-3 text-sm font-semibold text-ink-900">Applicants</h3>
              <ul className="divide-y divide-ink-100">
                {applicants.map((a) => (
                  <li key={a.id} className="space-y-2 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-ink-400" /><b className="text-ink-900">{a.name}</b></span>
                      <span className="font-mono text-xs text-ink-600">{a.email}{a.student_id_number ? ` · ID ${a.student_id_number}` : ''}</span>
                    </div>
                    {a.applications.map((app) => (
                      <p key={app.id} className="text-xs text-ink-500">
                        Application #{app.id} · {app.term} · {app.status.replace(/_/g, ' ')} — review it under Applications; while on, its interview can be set any time.
                      </p>
                    ))}
                    <RemoveFromTesting account={a} onRemoved={applied} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {recipients.map((r) => <RecipientCard key={r.id} account={r} enabled={on} onChanged={refresh} onRemoved={applied} />)}
          </div>
        </>
      )}
    </div>
  )
}

/** Search existing recipients/applicants and add one to testing (after a confirmation naming them). */
function ExistingPicker({ enabled, onAdded }: { enabled: boolean; onAdded: (res: WithStatus) => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: results, isFetching } = useQuery({
    queryKey: ['testing-candidates', query],
    queryFn: () => testingApi.candidates(query),
    enabled: enabled && query.length >= 2,
  })

  const add = useMutation({
    mutationFn: (id: number) => testingApi.addExisting(id),
    onSuccess: (res) => { setConfirmId(null); setSearch(''); setQuery(''); onAdded(res) },
    onError: (e: ApiRequestError) => { setConfirmId(null); setError(errorText(e, 'Could not add that account.')) },
  })

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><UserPlus className="h-4 w-4 text-brand-700" /> Pick an account to test</p>
      <p className="mt-1 max-w-3xl text-xs text-ink-500">
        A recipient or applicant. They stay a normal account: they can always sign in, get email at their own address and are counted
        in analytics. What the shortcuts change is recorded, and you can undo it when you remove them from testing.
      </p>
      <div className="relative mt-3 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input value={search} onChange={(e) => { setError(null); setSearch(e.target.value) }} disabled={!enabled}
          placeholder={enabled ? 'Name, email or student ID' : TESTING_OFF_MESSAGE}
          className="w-full rounded-xl border border-ink-300 bg-ink-50 py-2 pl-9 pr-3 text-sm focus:border-brand-700 focus:outline-none disabled:opacity-60" />
      </div>

      {enabled && query.length >= 2 && (
        <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
          {isFetching && !results && <li className="px-4 py-3 text-xs text-ink-500">Searching…</li>}
          {results?.length === 0 && <li className="px-4 py-3 text-xs text-ink-500">No matching recipient or applicant (accounts already in testing aren&apos;t listed).</li>}
          {results?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <b className="text-ink-900">{c.name}</b>
                <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] capitalize text-ink-600">{c.role}</span>
                <span className="mt-0.5 block font-mono text-xs text-ink-500">
                  {c.email}{c.student_id_number ? ` · ID ${c.student_id_number}` : ''}{c.term ? ` · ${c.term}` : ''}
                </span>
              </span>
              {confirmId === c.id ? (
                <span className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Shortcuts change {c.name}&apos;s real record until you undo them. Add?
                  <button onClick={() => add.mutate(c.id)} disabled={add.isPending} className="rounded-lg bg-brand-700 px-2.5 py-1 font-semibold text-white">
                    {add.isPending ? 'Adding…' : 'Yes, add'}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="font-semibold">Cancel</button>
                </span>
              ) : (
                <button onClick={() => { setError(null); setConfirmId(c.id) }} className={BTN}><UserPlus className="h-3.5 w-3.5" /> Add to testing</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs font-medium text-danger-700">{error}</p>}
    </div>
  )
}

/** Take a picked account out of testing: undo what the shortcuts changed, or keep it. Works while off too. */
function RemoveFromTesting({ account, onRemoved }: { account: TestingAccount; onRemoved: (res: WithStatus) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = account.changes

  const remove = useMutation({
    mutationFn: (undo: boolean) => testingApi.removeExisting(account.id, undo),
    onSuccess: onRemoved,
    onError: (e: ApiRequestError) => setError(errorText(e, 'Could not remove this account from testing.')),
  })

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">{n === 0 ? 'No changes recorded yet.' : `${n} ${n === 1 ? 'change' : 'changes'} recorded — they can be undone when you remove this account.`}</span>
        <button onClick={() => { setError(null); setOpen(true) }} className={BTN}><UserMinus className="h-3.5 w-3.5" /> Remove from testing</button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      {n === 0 ? (
        <p>Nothing was changed by the shortcuts. Remove {account.name} from testing?</p>
      ) : (
        <p>
          Undo puts back what the shortcuts changed ({n} {n === 1 ? 'change' : 'changes'}): added hours, report, evaluation and renewal are deleted; dates,
          term result and makeup deadline return to what they were. Clock-ins and anything people did on the normal pages stay, as does a renewal
          that was already decided.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => remove.mutate(true)} disabled={remove.isPending} className="rounded-lg bg-brand-700 px-2.5 py-1 font-semibold text-white disabled:opacity-50">
          {n === 0 ? 'Remove' : `Undo ${n} ${n === 1 ? 'change' : 'changes'} and remove`}
        </button>
        {n > 0 && (
          <button onClick={() => remove.mutate(false)} disabled={remove.isPending} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold disabled:opacity-50">
            Keep changes and remove
          </button>
        )}
        <button onClick={() => setOpen(false)} disabled={remove.isPending} className="font-semibold">Cancel</button>
      </div>
      {error && <p className="mt-2 font-medium text-danger-700">{error}</p>}
    </div>
  )
}

function RecipientCard({ account: r, enabled, onChanged, onRemoved }: {
  account: TestingAccount
  enabled: boolean
  onChanged: () => void
  onRemoved: (res: WithStatus) => void
}) {
  const [hours, setHours] = useState(5)
  const [status, setStatus] = useState<'verified' | 'pending_verification'>('verified')
  const [date, setDate] = useState('')
  const [rating, setRating] = useState(4)
  const [msg, setMsg] = useState<Note>(null)

  const act = useMutation({
    mutationFn: (v: { action: TestingAction; data?: Record<string, unknown> }) => testingApi.act(r.id, v.action, v.data),
    onSuccess: (res) => { setMsg({ text: res.message }); onChanged() },
    onError: (e: ApiRequestError) => setMsg({ text: errorText(e, 'That shortcut failed.'), error: true }),
  })
  const run = (action: TestingAction, data?: Record<string, unknown>) => { setMsg(null); act.mutate({ action, data }) }
  const busy = act.isPending || !enabled

  const current = r.assignments.find((a) => a.status === 'active') ?? r.assignments[0]

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">{r.name}</p>
          <p className="font-mono text-xs text-ink-500">{r.email}{r.student_id_number ? ` · ID ${r.student_id_number}` : ''}</p>
        </div>
        {current && <TermBadge badge={current.term_badge} />}
      </div>

      {current ? (
        <p className="mt-2 text-xs text-ink-600">
          {current.term} · {current.verified_hours}h / {current.required_hours}h verified
          {current.end_date ? ` · ends ${formatDay(current.end_date)}` : ''}
          {current.report_submitted ? ' · report in' : ''}{current.evaluation ? ` · evaluated ${current.evaluation}/5` : ''}
          {current.promissory ? ` · promissory ${current.promissory}` : ''}
        </p>
      ) : <p className="mt-2 text-xs text-ink-500">No current term.</p>}
      {r.applications.filter((a) => a.type === 'renewal').map((a) => (
        <p key={a.id} className="text-xs text-violet-700">Renewal #{a.id} · {a.term} · {a.status}</p>
      ))}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-ink-50 p-3">
          <Clock className="mb-2 h-4 w-4 text-ink-500" />
          <label className="text-xs text-ink-600">Hours
            <input type="number" step={0.25} min={0.25} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={`${SMALL} w-20`} />
          </label>
          <label className="text-xs text-ink-600">As
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={SMALL}>
              <option value="verified">verified</option>
              <option value="pending_verification">pending</option>
            </select>
          </label>
          <label className="text-xs text-ink-600">Date (optional)
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={SMALL} />
          </label>
          <button onClick={() => run('hours', { hours, status, ...(date ? { date } : {}) })} disabled={busy} className={BTN}>Add hours</button>
          <button onClick={() => run('complete-hours')} disabled={busy} className={BTN}
            title="Log exactly the hours still missing, verified (up to 8 h a day on past days), so the required hours are complete.">
            <CheckCheck className="h-3.5 w-3.5" /> Complete hours</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => run('clock-in')} disabled={busy} className={BTN}
            title="Open a shift now without the QR scan. The student clocks out by scanning their office QR.">
            <LogIn className="h-3.5 w-3.5" /> Clock in now</button>
          <button onClick={() => run('auto-clock-out')} disabled={busy} className={BTN}
            title="Close the open shift the way the hourly safety net does after 12 hours; the log then waits for the supervisor's review.">
            <LogOut className="h-3.5 w-3.5" /> Auto clock-out</button>
          <span className="text-xs text-ink-500">
            {r.clocked_in_since
              ? `Clocked in since ${new Date(r.clocked_in_since).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Not clocked in'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => run('end-term')} disabled={busy} className={BTN} title="The term's last day becomes yesterday: promissory notes and term-end rules apply now.">
            <CalendarX className="h-3.5 w-3.5" /> End term now</button>
          <button onClick={() => run('file-promissory')} disabled={busy} className={BTN}
            title="File a promissory note for the student with a sample PDF (only after the term has ended). Their supervisor then reviews it.">
            <FileSignature className="h-3.5 w-3.5" /> File promissory note</button>
          <button onClick={() => run('close-term')} disabled={busy} className={BTN} title="Record Qualified or Deficient now (this term only).">
            <Gavel className="h-3.5 w-3.5" /> Close term now</button>
          <button onClick={() => run('makeup-overdue')} disabled={busy} className={BTN} title="An approved promissory note's makeup deadline becomes yesterday.">
            <AlarmClock className="h-3.5 w-3.5" /> Make makeup overdue</button>
          <button onClick={() => run('term-report')} disabled={busy} className={BTN}>
            <FileText className="h-3.5 w-3.5" /> Submit end-of-term report</button>
          <span className="flex items-center gap-1">
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className={SMALL} aria-label="Evaluation rating">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
            </select>
            <button onClick={() => run('evaluation', { rating })} disabled={busy} className={BTN}><Star className="h-3.5 w-3.5" /> Evaluate</button>
          </span>
          <button onClick={() => run('renewal')} disabled={busy} className={BTN} title="Submit a renewal for the next term with a sample COR, even if renewal is closed.">
            <RefreshCw className="h-3.5 w-3.5" /> Submit renewal</button>
          <button onClick={() => run('reset-term')} disabled={busy} className={BTN} title="Back to in progress: clears the verdict and the term-end shortcut.">
            <RotateCcw className="h-3.5 w-3.5" /> Reset term</button>
        </div>
      </div>

      {!enabled && <p className="mt-3 text-xs text-ink-500">{TESTING_OFF_MESSAGE}</p>}
      {msg && <p className={`mt-3 text-xs font-medium ${msg.error ? 'text-danger-700' : 'text-success-700'}`}>{msg.text}</p>}
      <div className="mt-4 border-t border-ink-100 pt-3"><RemoveFromTesting account={r} onRemoved={onRemoved} /></div>
    </div>
  )
}

const SMALL = 'mt-0.5 block rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-xs focus:border-brand-700 focus:outline-none'
const BTN = 'flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-50'
