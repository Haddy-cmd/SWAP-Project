'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, UserRound, Clock, CalendarX, Gavel, FileText, ClipboardCheck, RefreshCw, RotateCcw, Search, UserPlus,
  UserMinus, Undo2, CheckCheck, LogIn, LogOut, FileSignature, Eraser, Banknote, BadgeCheck, ThumbsUp, ThumbsDown,
  Ticket, Wallet, History, HardDrive, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { testingApi } from '@/lib/api/testing.api'
import { errorText } from '@/lib/utils/apiError'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { TermBadge } from '@/components/shared/TermBadge'
import { formatDay } from '@/lib/utils/semester'
import type { ApiRequestError } from '@/lib/api/axios'
import { TESTING_OFF_MESSAGE, type EarlierTest, type StorageCheck, type TestingAccount, type TestingAction, type TestingStatus } from '@/types/testing.types'


type Note = { text: string; error?: boolean } | null
type WithStatus = { data: TestingStatus; message: string }

/**
 * Admin → System Testing: pick existing recipients/applicants and use shortcuts that move
 * their data into the state a test needs (end a term now, add hours, file a promissory note…), so
 * time-gated flows can be tried without waiting. Picking copies the account's record;
 * removing it, or switching testing off, restores that copy — whatever changed it. Picking,
 * the relaxed rules and the shortcuts only work while on.
 */
export default function SystemTestingPage() {
  const qc = useQueryClient()
  const [note, setNote] = useState<Note>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  // A tool page: results stay in its note line; failures pop out like everywhere else.
  const { notifyError } = useFeedback()

  const { data, isLoading, isError } = useQuery({ queryKey: ['testing-status'], queryFn: testingApi.status, retry: false })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['testing-status'] })
    qc.invalidateQueries({ queryKey: ['testing-candidates'] })
    qc.invalidateQueries({ queryKey: ['testing-earlier'] })
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
    onSuccess: (res) => { setConfirmOff(false); applied(res) },
    onError: (e: ApiRequestError) => { setConfirmOff(false); notifyError(e, 'Could not change the switch') },
  })
  const releaseAll = useMutation({
    mutationFn: () => testingApi.releaseAll(),
    onSuccess: (res) => { setConfirmAll(false); applied(res) },
    onError: (e: ApiRequestError) => { setConfirmAll(false); notifyError(e, 'Could not restore the accounts') },
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
          Pick existing recipients or applicants and use shortcuts to try flows without waiting — end a term now, add hours, file a
          promissory note. While on, picked accounts may also clock in any day, any hour, from anywhere and without a selfie, and their
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
              : 'Every account follows the normal rules. Switching off restored every picked account to how it was when picked.'}
          </p>
          {confirmOff && (
            <span className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Switching off restores {data.accounts.length} {data.accounts.length === 1 ? 'account' : 'accounts'} to how
              {data.accounts.length === 1 ? ' it was' : ' they were'} when picked. Everything done to them during the test is removed.
              <button onClick={() => toggle.mutate(false)} disabled={toggle.isPending} className="rounded-lg bg-brand-700 px-2.5 py-1 font-semibold text-white">
                {toggle.isPending ? 'Restoring…' : 'Yes, switch off'}
              </button>
              <button onClick={() => setConfirmOff(false)} className="font-semibold">Cancel</button>
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="System Testing"
          disabled={toggle.isPending}
          onClick={() => {
            setNote(null)
            // Switching off restores the picked accounts: ask first.
            if (on && data.accounts.length > 0) setConfirmOff(true)
            else toggle.mutate(!on)
          }}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-success-600' : 'bg-ink-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <ExistingPicker enabled={on} onAdded={applied} />

      <EarlierTests onCleaned={applied} />

      <FileStorage />

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
                <Undo2 className="h-3.5 w-3.5" /> Restore all
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                Restore every account to how it was when picked and remove them all from testing?
                <button onClick={() => releaseAll.mutate()} disabled={releaseAll.isPending} className="rounded-lg bg-danger-700 px-2.5 py-1 font-semibold text-white">
                  {releaseAll.isPending ? 'Restoring…' : 'Yes, restore all'}
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
        in analytics. Their record is copied when you pick them, and put back exactly when you remove them or switch testing off.
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
                  Everything that happens to {c.name}&apos;s record while in testing — including what they do themselves — is reset when
                  you remove them or switch testing off. Add?
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

/** Take a picked account out of testing, restoring it to how it was when picked. Works while off too. */
function RemoveFromTesting({ account, onRemoved }: { account: TestingAccount; onRemoved: (res: WithStatus) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picked = new Date(account.picked_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const remove = useMutation({
    mutationFn: () => testingApi.removeExisting(account.id),
    onSuccess: onRemoved,
    onError: (e: ApiRequestError) => setError(errorText(e, 'Could not remove this account from testing.')),
  })

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">
          {account.restorable
            ? `Picked ${picked}. Removing it or switching off restores this account to that moment.`
            : 'Picked before restore points existed: removing it cleans up what was created while it was in testing.'}
        </span>
        <button onClick={() => { setError(null); setOpen(true) }} className={BTN}><UserMinus className="h-3.5 w-3.5" /> Restore and remove</button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p>
        Put {account.name}&apos;s record back to how it was on {picked}? Everything done to it since — hours, notes, reviews, results, reports,
        evaluations, renewals and their placements, stubs and payouts, including what they did themselves — is removed or changed back.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded-lg bg-brand-700 px-2.5 py-1 font-semibold text-white disabled:opacity-50">
          {remove.isPending ? 'Restoring…' : 'Yes, restore and remove'}
        </button>
        <button onClick={() => setOpen(false)} disabled={remove.isPending} className="font-semibold">Cancel</button>
      </div>
      {error && <p className="mt-2 font-medium text-danger-700">{error}</p>}
    </div>
  )
}

/**
 * Where uploads (signatures, photos, documents) are kept and whether they're still there —
 * the reasons a signature shows as a broken image on live. Works with the switch off.
 */
function FileStorage() {
  const check = useMutation({ mutationFn: () => testingApi.storageCheck() })
  const r: StorageCheck | undefined = check.data

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><HardDrive className="h-4 w-4 text-brand-700" /> File storage</p>
          <p className="mt-1 max-w-3xl text-xs text-ink-500">
            Checks where uploaded signatures, photos and documents are kept, saves and reads back a test file, and lists accounts whose
            signature or photo is on record but no longer in storage.
          </p>
        </div>
        <button onClick={() => check.mutate()} disabled={check.isPending} className={BTN}>
          <RefreshCw className={`h-3.5 w-3.5 ${check.isPending ? 'animate-spin' : ''}`} /> {check.isPending ? 'Checking…' : 'Check storage'}
        </button>
      </div>

      {check.isError && <p className="mt-3 text-sm font-medium text-danger-700">{errorText(check.error as ApiRequestError, 'Could not check the storage.')}</p>}

      {r && (
        <ul className="mt-4 space-y-2 text-sm">
          <StorageRow ok={!r.disk.warning} title="Where files are kept"
            text={r.disk.warning ?? `${r.disk.durable ? 'Cloud storage' : 'This computer'} (${r.disk.name}${r.disk.driver ? `, ${r.disk.driver}` : ''}).`} />
          <StorageRow ok={r.probe.ok} title="Save and read a test file"
            text={r.probe.ok ? 'A test file was saved, read back and deleted.' : `Failed to ${r.probe.step}: ${r.probe.error}`} />
          <StorageRow ok={!r.links.warning} title="Image links" text={r.links.warning ?? `Signatures and photos load from ${r.links.app_url}.`} />
          <StorageRow ok={r.missing.files.length === 0 && r.missing.unchecked === 0} title="Missing files"
            text={[
              r.missing.files.length
                ? `${r.missing.files.length} ${r.missing.files.length === 1 ? 'file is' : 'files are'} on record but not in storage. Ask these people to draw their signature again (or upload their photo again) on their Profile.`
                : 'Every signature and photo on record is in storage.',
              r.missing.unchecked ? `${r.missing.unchecked} couldn't be checked.` : '',
              r.missing.checked < r.missing.total ? `Checked the first ${r.missing.checked} of ${r.missing.total} files.` : '',
            ].filter(Boolean).join(' ')}>
            {r.missing.files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {r.missing.files.map((f) => (
                  <li key={`${f.user_id}-${f.file}`} className="text-xs text-ink-700">
                    <b>{f.name}</b> · {f.role} · {f.file === 'signature' ? 'Signature' : 'Photo'}
                    <span className="ml-1 font-mono text-ink-500">{f.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </StorageRow>
        </ul>
      )}
    </div>
  )
}

function StorageRow({ ok, title, text, children }: { ok: boolean; title: string; text: string; children?: ReactNode }) {
  return (
    <li className={`flex gap-2 rounded-xl border px-3 py-2 ${ok ? 'border-success-200 bg-success-50/50' : 'border-amber-200 bg-amber-50'}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-700" />}
      <div className="min-w-0">
        <p className="font-semibold text-ink-900">{title}</p>
        <p className={`text-xs ${ok ? 'text-ink-600' : 'text-amber-900'}`}>{text}</p>
        {children}
      </div>
    </li>
  )
}

/** Accounts tested before restore points existed: what's left over, and a one-time cleanup. */
function EarlierTests({ onCleaned }: { onCleaned: (res: WithStatus) => void }) {
  const { data: accounts = [] } = useQuery({ queryKey: ['testing-earlier'], queryFn: testingApi.earlierTests })
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clean = useMutation({
    mutationFn: (id: number) => testingApi.cleanUpEarlierTest(id),
    onSuccess: (res) => { setOpen(null); onCleaned(res) },
    onError: (e: ApiRequestError) => setError(errorText(e, 'Could not clean up this account.')),
  })

  if (!accounts.length) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><History className="h-4 w-4 text-amber-700" /> Tested before restore points</p>
      <p className="mt-1 max-w-3xl text-xs text-ink-600">
        These accounts were tested before System Testing kept a copy of each record, so some test data is still on them. A cleanup removes what
        was created for the account while it was in testing (going by the audit log), makes its earlier placement active again if a renewal
        replaced it, and puts its term result back.
      </p>
      <ul className="mt-3 space-y-2">
        {accounts.map((a: EarlierTest) => (
          <li key={a.id} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <b className="text-ink-900">{a.name}</b>
                <span className="mt-0.5 block font-mono text-xs text-ink-500">{a.email}{a.student_id_number ? ` · ID ${a.student_id_number}` : ''}</span>
                <span className="mt-0.5 block text-xs text-ink-500">Tested {a.tested.join('; ')}{a.picked ? ' (still picked)' : ''}</span>
              </span>
              {open !== a.id && (
                <button onClick={() => { setError(null); setOpen(a.id) }} className={BTN}><Eraser className="h-3.5 w-3.5" /> Preview cleanup</button>
              )}
            </div>
            {open === a.id && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {a.items.length ? (
                  <ul className="list-disc space-y-0.5 pl-4">{a.items.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p>Nothing was created during the test; the cleanup only takes the account out of testing.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => clean.mutate(a.id)} disabled={clean.isPending} className="rounded-lg bg-brand-700 px-2.5 py-1 font-semibold text-white disabled:opacity-50">
                    {clean.isPending ? 'Cleaning up…' : 'Clean up'}
                  </button>
                  <button onClick={() => setOpen(null)} disabled={clean.isPending} className="font-semibold">Cancel</button>
                </div>
                {error && <p className="mt-2 font-medium text-danger-700">{error}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
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
  const [eligible, setEligible] = useState(true)
  const [msg, setMsg] = useState<Note>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmStipend, setConfirmStipend] = useState(false)
  const { notifyError } = useFeedback()

  const act = useMutation({
    mutationFn: (v: { action: TestingAction; data?: Record<string, unknown> }) => testingApi.act(r.id, v.action, v.data),
    onSuccess: (res) => { setMsg({ text: res.message }); onChanged() },
    onError: (e: ApiRequestError) => notifyError(e, 'That shortcut failed'),
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
          {current.pending_hours > 0 ? ` · ${current.pending_hours}h pending` : ''}
          {current.end_date ? ` · ends ${formatDay(current.end_date)}` : ''}
          {current.report_submitted ? ' · report in' : ''}
          {current.report_eligible !== null ? ` · report accepted (${current.report_eligible ? 'eligible' : 'not eligible'})` : ''}
          {current.promissory ? ` · promissory ${current.promissory}` : ''}
          {current.stipend ? ` · stipend ${STIPEND_LABEL[current.stipend] ?? current.stipend}` : ''}
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
          <button onClick={() => run('verify-hours')} disabled={busy} className={BTN}
            title="As the supervisor: verify every hour waiting for review (the real verification, with its notifications).">
            <BadgeCheck className="h-3.5 w-3.5" /> Verify pending hours</button>
          <button onClick={() => run('complete-hours')} disabled={busy} className={BTN}
            title="Log exactly the hours still missing, verified (up to 8 h a day on past days), so the required hours are complete.">
            <CheckCheck className="h-3.5 w-3.5" /> Complete hours</button>
          {!confirmReset ? (
            <button onClick={() => { setMsg(null); setConfirmReset(true) }} disabled={busy} className={BTN}
              title="Set every hour of this term aside so it starts again at 0. Undo on Remove from testing brings them all back.">
              <Eraser className="h-3.5 w-3.5" /> Reset hours</button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              Set aside all {current?.verified_hours ?? 0}h of this term?
              <button onClick={() => { setConfirmReset(false); run('reset-hours') }} disabled={busy} className="rounded-md bg-brand-700 px-2 py-0.5 font-semibold text-white">Yes, reset</button>
              <button onClick={() => setConfirmReset(false)} className="font-semibold">Cancel</button>
            </span>
          )}
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
          <button onClick={() => run('approve-promissory')} disabled={busy} className={BTN}
            title="As the supervisor: approve the pending note, recording its lacking hours (added to the next term if the student renews).">
            <ThumbsUp className="h-3.5 w-3.5" /> Approve note</button>
          <button onClick={() => run('reject-promissory')} disabled={busy} className={BTN} title="As the supervisor: reject the pending note.">
            <ThumbsDown className="h-3.5 w-3.5" /> Reject note</button>
          <button onClick={() => run('close-term')} disabled={busy} className={BTN} title="Record Qualified or Deficient now (this term only).">
            <Gavel className="h-3.5 w-3.5" /> Close term now</button>
          <button onClick={() => run('term-report')} disabled={busy} className={BTN}>
            <FileText className="h-3.5 w-3.5" /> Submit end-of-term report</button>
          <span className="flex items-center gap-1">
            <select value={eligible ? 'yes' : 'no'} onChange={(e) => setEligible(e.target.value === 'yes')} className={SMALL} aria-label="Renewal mark">
              <option value="yes">Eligible</option>
              <option value="no">Not eligible</option>
            </select>
            <button onClick={() => run('review-report', { eligible })} disabled={busy} className={BTN}
              title="As the supervisor: accept the end-of-term report and mark the student eligible or not for renewal.">
              <ClipboardCheck className="h-3.5 w-3.5" /> Accept report</button>
          </span>
          <button onClick={() => run('renewal')} disabled={busy} className={BTN} title="Submit a renewal for the next term with a sample COR, even if renewal is closed.">
            <RefreshCw className="h-3.5 w-3.5" /> Submit renewal</button>
          <button onClick={() => run('reset-term')} disabled={busy} className={BTN} title="Back to in progress: clears the verdict and the term-end shortcut.">
            <RotateCcw className="h-3.5 w-3.5" /> Reset term</button>
          <button onClick={() => run('release-stub')} disabled={busy} className={BTN}
            title="As the admin (Admin → Stipend): release this term's claim stub, with the real checks (hours or approved note, signature, end-of-term report).">
            <Ticket className="h-3.5 w-3.5" /> Release claim stub</button>
          <button onClick={() => run('pay-out')} disabled={busy} className={BTN}
            title="As the Banking Office: scan the ready-to-claim stub and pay it out (no PIN needed here).">
            <Wallet className="h-3.5 w-3.5" /> Pay out</button>
          {!confirmStipend ? (
            <button onClick={() => { setMsg(null); setConfirmStipend(true) }} disabled={busy} className={BTN}
              title="Remove this term's stipend stub so the student is eligible again under Admin → Stipend. Undo on Remove from testing brings it back.">
              <Banknote className="h-3.5 w-3.5" /> Reset stipend</button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              Remove the {current?.term ?? 'term'} stub so the stipend can be released again?
              <button onClick={() => { setConfirmStipend(false); run('reset-stipend') }} disabled={busy} className="rounded-md bg-brand-700 px-2 py-0.5 font-semibold text-white">Yes, reset</button>
              <button onClick={() => setConfirmStipend(false)} className="font-semibold">Cancel</button>
            </span>
          )}
        </div>
      </div>

      {!enabled && <p className="mt-3 text-xs text-ink-500">{TESTING_OFF_MESSAGE}</p>}
      {msg && <p className={`mt-3 text-xs font-medium ${msg.error ? 'text-danger-700' : 'text-success-700'}`}>{msg.text}</p>}
      <div className="mt-4 border-t border-ink-100 pt-3"><RemoveFromTesting account={r} onRemoved={onRemoved} /></div>
    </div>
  )
}

// How the term's stub reads on the card.
const STIPEND_LABEL: Record<string, string> = { pending: 'being prepared', certified: 'ready to claim', claimed: 'received', released: 'received' }

const SMALL = 'mt-0.5 block rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-xs focus:border-brand-700 focus:outline-none'
const BTN = 'flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-50'
