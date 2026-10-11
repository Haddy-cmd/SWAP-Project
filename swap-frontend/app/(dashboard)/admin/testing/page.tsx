'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, ToggleLeft, Clock, MapPinOff, CameraOff, CalendarClock, UserSearch, PlusCircle, RotateCcw, Mail, Bell, UserPlus, Loader2 } from 'lucide-react'
import { testingApi } from '@/lib/api/testing.api'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { ApiRequestError } from '@/lib/api/axios'
import { TESTING_OFF_MESSAGE, type TestingCandidate, type TestingStatus } from '@/types/testing.types'
import { AccountPanel } from '@/components/admin/testing/AccountPanel'
import { EarlierTestsPanel, LoginCodePanel, StoragePanel } from '@/components/admin/testing/SidePanels'
import { CARD, initials, stageOf } from '@/components/admin/testing/ui'

type WithStatus = { data: TestingStatus; message: string }

const RELAXED = [
  { Icon: Clock, label: 'Clock in any day, any hour' },
  { Icon: MapPinOff, label: 'No location check' },
  { Icon: CameraOff, label: 'No selfie needed' },
  { Icon: CalendarClock, label: 'Interviews any time' },
]

/**
 * Admin → System Testing (layout "System Testing v2"): add existing recipients/applicants and
 * use shortcuts that move their data into the state a test needs (end a term now, add hours,
 * file a promissory note…). Adding copies the account's record; "Undo all changes", or
 * switching testing off, puts that copy back — whatever changed it. Adding, the relaxed rules
 * and the shortcuts only work while on; the account controls and the storage check always do.
 */
export default function SystemTestingPage() {
  const qc = useQueryClient()
  const { notify, notifyError, confirm } = useFeedback()
  const [selectedId, setSelectedId] = useState<number | null>(null)

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
  }
  const appliedWithNote = (res: WithStatus) => { applied(res); notify({ title: res.message, detail: null }) }

  const toggle = useMutation({
    mutationFn: (on: boolean) => testingApi.setEnabled(on),
    onSuccess: appliedWithNote,
    onError: (e: ApiRequestError) => notifyError(e, 'Could not change the switch'),
  })
  const releaseAll = useMutation({
    mutationFn: () => testingApi.releaseAll(),
    onSuccess: appliedWithNote,
    onError: (e: ApiRequestError) => notifyError(e, 'Could not restore the accounts'),
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-[18px] bg-ink-100" />
  if (isError || !data) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <FlaskConical className="mx-auto h-8 w-8 text-ink-300" />
        <p className="mt-2 font-semibold text-ink-900">Could not load System Testing</p>
        <p className="mt-1 text-sm text-ink-500">Refresh the page to try again.</p>
      </div>
    )
  }

  const on = data.enabled
  const accounts = data.accounts
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null
  const n = accounts.length

  const flip = async () => {
    // Switching off restores the picked accounts: ask first.
    if (on && n > 0 && !(await confirm({
      title: 'Switch System Testing off?',
      body: `This restores ${n} ${n === 1 ? 'account' : 'accounts'} to how ${n === 1 ? 'it was' : 'they were'} when added. Everything done to them during the test is removed.`,
      confirmLabel: 'Switch off and restore', tone: 'danger',
    }))) return
    toggle.mutate(!on)
  }
  const restoreAll = async () => {
    if (await confirm({
      title: 'Restore all accounts?',
      body: `Every account in testing (${n}) goes back to how it was when added and leaves System Testing.`,
      confirmLabel: 'Restore all', tone: 'danger',
    })) releaseAll.mutate()
  }

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="flex items-center gap-2.5 font-serif text-[30px] font-medium leading-tight text-ink-950">
          <FlaskConical className="h-7 w-7 text-accent" /> System Testing
        </h1>
        <p className="mt-1 max-w-[760px] text-[13.5px] text-ink-500">
          Try SWAP flows on real accounts without waiting: add hours, end a term, file a note. Every account is copied first, so you can put it back exactly as it was.
        </p>
        {data?.login_code && !data.login_code.required && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-[12px] font-semibold text-warning-700">
            Sign-in codes are off for everyone{data.login_code.server_off ? ' (on the server)' : ''}
          </p>
        )}
      </div>

      {/* Mode banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-[18px] border px-[22px] py-[18px]"
        style={on ? { background: 'linear-gradient(120deg,var(--color-gold-50),var(--color-warning-50))', borderColor: 'var(--color-gold-200)' } : { background: 'var(--color-surface)', borderColor: 'rgba(30,70,50,.1)' }}>
        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px]"
          style={on ? { background: 'var(--color-gold-accent)', color: '#2B2200' } : { background: 'var(--color-surface-3)', color: 'var(--text-ink-500)' }}>
          {on ? <FlaskConical className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
        </span>
        <div className="min-w-[240px] flex-1">
          <p className="text-[16px] font-extrabold" style={{ color: on ? 'var(--text-gold-800)' : 'var(--text-ink-950)' }}>{on ? 'Testing is on' : 'Testing is off'}</p>
          <p className="mt-0.5 text-[13px]" style={{ color: on ? 'var(--text-gold-800)' : 'var(--text-ink-500)' }}>
            {on
              ? 'For the accounts below only, these rules are relaxed. Turn it off when you finish — every account is put back.'
              : 'Shortcuts are paused. Turn it on to add accounts and test flows. Undo, Stop testing and the storage check still work.'}
          </p>
          {on && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {RELAXED.map((r) => (
                <span key={r.label} className="flex items-center gap-1 rounded-full bg-surface/70 px-2.5 py-1 text-[11.5px] font-semibold text-gold-800">
                  <r.Icon className="h-3.5 w-3.5" /> {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label="System Testing" onClick={flip} disabled={toggle.isPending}
          className={`flex h-8 w-14 flex-none rounded-full p-[3px] transition-colors disabled:opacity-60 ${on ? 'justify-end bg-accent' : 'justify-start bg-ink-300'}`}>
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white shadow">
            {toggle.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
          </span>
        </button>
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <div className={CARD}>
            <div className="px-4 pb-3 pt-4">
              <p className="text-[14.5px] font-bold">Add an account to test</p>
              <Picker enabled={on} onAdded={(res, id) => { appliedWithNote(res); setSelectedId(id) }} />
              <p className="mt-2 text-[11.5px] leading-snug text-ink-400">They stay a normal account and keep signing in as usual. Emails start off.</p>
            </div>
            <div className="flex items-center justify-between border-t border-ink-900/[.05] bg-surface-2 px-4 py-2.5">
              <span className="text-[12.5px] font-bold text-ink-600">In testing · {n}</span>
              {n > 0 && (
                <button onClick={restoreAll} disabled={releaseAll.isPending}
                  className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-red-strong hover:bg-danger-100 disabled:opacity-50">
                  {releaseAll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore all
                </button>
              )}
            </div>
            {n === 0 ? (
              <p className="border-t border-ink-900/[.04] px-4 py-6 text-center text-[12.5px] text-ink-500">No accounts yet. Search above to add one.</p>
            ) : accounts.map((a) => {
              const sel = a.id === selected?.id
              return (
                <button key={a.id} onClick={() => setSelectedId(a.id)} aria-current={sel}
                  className={`flex w-full items-center gap-2.5 border-t border-ink-900/[.04] px-4 py-3 text-left transition-colors ${sel ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'bg-surface hover:bg-surface-2'}`}>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold"
                    style={sel ? { background: 'var(--color-accent-deep)', color: '#fff' } : { background: 'var(--color-brand-100)', color: 'var(--text-accent-deep)' }}>{initials(a.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{a.name}</span>
                    <span className="mt-px block truncate text-[11.5px] text-ink-500">{a.role === 'recipient' ? 'Recipient' : 'Applicant'} · {stageOf(a)}</span>
                  </span>
                  <span title={a.email_muted ? 'Emails off (bell notifications only)' : 'Emails on'}>
                    {a.email_muted ? <Bell className="h-4 w-4 text-ink-300" /> : <Mail className="h-4 w-4 text-accent" />}
                  </span>
                </button>
              )
            })}
          </div>
          <LoginCodePanel state={data?.login_code} onChanged={appliedWithNote} />
          <StoragePanel />
          <EarlierTestsPanel onCleaned={appliedWithNote} />
        </div>

        {/* Right */}
        {selected ? (
          <AccountPanel key={selected.id} account={selected} enabled={on}
            onStatus={applied}
            onShortcutDone={refresh} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-ink-300 bg-surface px-5 py-16 text-center">
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong"><UserPlus className="h-6 w-6" /></span>
            <p className="text-[15px] font-bold">Add an account to start</p>
            <p className="text-[13px] text-ink-500">{on ? 'Search for a recipient or applicant on the left.' : `${TESTING_OFF_MESSAGE} Then search for a recipient or applicant on the left.`}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Search existing recipients/applicants (not yet in testing) and add one after a confirmation naming them. */
function Picker({ enabled, onAdded }: { enabled: boolean; onAdded: (res: WithStatus, id: number) => void }) {
  const { confirm, notifyError } = useFeedback()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

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
    onSuccess: (res, id) => { setSearch(''); setQuery(''); onAdded(res, id) },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not add that account'),
  })

  const pick = async (c: TestingCandidate) => {
    if (await confirm({
      title: `Add ${c.name} to testing?`,
      body: `Everything that happens to ${c.name}'s record while in testing — including what they do themselves — can be undone with "Undo all changes" or by switching testing off. Their emails start off.`,
      confirmLabel: 'Add to testing',
    })) add.mutate(c.id)
  }

  const open = enabled && query.length >= 2
  return (
    <div className="relative mt-2.5">
      <div className="flex h-[42px] items-center gap-2.5 rounded-xl bg-surface-2 px-3">
        <UserSearch className="h-5 w-5 text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} disabled={!enabled || add.isPending}
          placeholder={enabled ? 'Name, email or student ID' : TESTING_OFF_MESSAGE} aria-label="Search accounts to add"
          className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-ink-950 focus:outline-none disabled:opacity-60" />
        {(isFetching || add.isPending) && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
      </div>
      {open && (
        <div className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-[0_10px_30px_rgba(20,40,30,.14)]">
          {!results && <p className="px-3.5 py-3 text-[12.5px] text-ink-500">Searching…</p>}
          {results?.length === 0 && <p className="px-3.5 py-3 text-[12.5px] text-ink-500">No account found (accounts already in testing aren&apos;t listed).</p>}
          {results?.map((c) => (
            <button key={c.id} onClick={() => pick(c)} disabled={add.isPending}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-accent-tint">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-accent-deep">{initials(c.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{c.name}</span>
                <span className="block truncate text-[11.5px] text-ink-500">
                  {c.role === 'recipient' ? 'Recipient' : 'Applicant'}{c.student_id_number ? ` · ID ${c.student_id_number}` : ''}{c.term ? ` · ${c.term}` : ''}
                </span>
              </span>
              <PlusCircle className="h-[19px] w-[19px] flex-none text-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
