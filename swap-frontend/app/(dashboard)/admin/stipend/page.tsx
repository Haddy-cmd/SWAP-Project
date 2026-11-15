'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Lock, Wallet, Receipt, Check, Minus, Pencil, Undo2, AlertCircle, Ban, ChevronDown, ChevronUp, BellRing, PenLine,
  FileText, NotebookPen, Search, History, Loader2, X, CheckCircle2, ArrowUpDown, CalendarRange,
} from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { formatDate } from '@/lib/utils/formatDate'
import { COLLEGES, collegeDisplay } from '@/lib/constants/colleges'
import { useAuthStore } from '@/lib/store/authStore'
import type { StipendRecord, EligibleStipend, StipendStatus, StipendTerm } from '@/types/analytics.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { CountUp } from '@/components/ui/CountUp'
import { AuditHistoryDrawer } from '@/components/admin/AuditHistory'
import { ExportButtons } from '@/components/reports/ExportButtons'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const peso = (n: number) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
const toNumber = (v: string) => { const n = parseFloat(v.replace(/,/g, '')); return Number.isFinite(n) ? n : NaN }
const DEFAULT_REMARKS = 'Completed required service hours.'

// A release is final. `claimed` (paid at the Banking Office) and `certified`/`pending`
// (ready to claim, migrated to released) are legacy stubs from before 2026-10-05.
const STATUS_META: Record<StipendStatus, { label: string; fg: string; bg: string }> = {
  released: { label: 'Released', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  certified: { label: 'Released', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  pending: { label: 'Released', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  // Legacy Banking Office pickup: paid; the row's "Received {date}" line says when.
  claimed: { label: 'Released', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  void: { label: 'Void', fg: 'var(--text-red-strong)', bg: 'var(--color-danger-100)' },
}
// Same rule as StipendClaimService::void: anything but a void stub or a legacy Banking Office payout.
const canVoid = (status: StipendStatus) => status !== 'void' && status !== 'claimed'

// The page gate stays open for 15 minutes of activity, then re-locks.
const GATE_TIMEOUT_MS = 15 * 60 * 1000

type ApiError = { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
type Tab = 'release' | 'history'
type Chip = 'all' | 'released' | 'received' | 'not_received' | 'void'

type Sort = 'new' | 'old' | 'amount' | 'name'
/** Shared by both tabs. `term` is "2025-2026|1st Semester" ('' = all terms). */
type Filters = { term: string; college: string; promissory: boolean; search: string }
const NO_FILTERS: Filters = { term: '', college: '', promissory: false, search: '' }
const isFiltered = (f: Filters) => !!(f.term || f.college || f.promissory || f.search.trim())

/** The same filters as query params for GET /admin/stipend (search is passed already debounced). */
const apiParams = (f: Filters, q: string): Record<string, string> => {
  const [academic_year, semester] = f.term ? f.term.split('|') : []
  return {
    ...(academic_year && { academic_year, semester }),
    ...(f.college && { college: f.college }),
    ...(f.promissory && { promissory: '1' }),
    ...(q && { search: q }),
  }
}

/** To release isn't paginated, so its rows are filtered here, by the same rules as the server. */
const matches = (e: EligibleStipend, f: Filters, q: string) =>
  (!f.term || `${e.academic_year}|${e.semester}` === f.term)
  && (!f.college || e.college === f.college)
  && (!f.promissory || e.via_promissory)
  && (!q || `${e.name} ${e.student_id_number ?? ''}`.toLowerCase().includes(q.toLowerCase()))

const keyOf = (e: EligibleStipend) => `${e.user_id}|${e.academic_year}|${e.semester}`
const shortHours = (e: EligibleStipend) => e.deficient_hours ?? e.lacking_hours ?? Math.max(0, e.required_hours - e.verified_hours)

/**
 * Admin → Stipend (layout "SWAP Admin Stipend v2"), behind the page password. "To release":
 * tick who's ready, adjust amounts, release from the bottom bar (final; each recipient is
 * notified); the ones still missing a signature or end-of-term report are listed with Remind.
 * "History": every stub with paid-out totals, filters, search, its history and Void.
 */
export default function AdminStipendPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { notify, notifyError } = useFeedback()
  const [tab, setTab] = useState<Tab>('release')
  // Page gate: the unlock token lives in memory only — never persisted.
  const [unlockToken, setUnlockToken] = useState<string | null>(null)
  const [unlockPw, setUnlockPw] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [q, setQ] = useState('')
  useEffect(() => { const t = setTimeout(() => setQ(filters.search.trim()), 300); return () => clearTimeout(t) }, [filters.search])
  const params = apiParams(filters, q)

  const { data: eligible = [], isLoading: eligibleLoading } = useQuery({
    queryKey: ['admin-stipend-eligible'],
    queryFn: () => adminApi.getEligibleStipends(),
    enabled: !!unlockToken,
  })
  // The History count (same filters) and the Term filter's options.
  const { data: totals } = useQuery({
    queryKey: ['admin-stipend', 'totals', params],
    queryFn: () => adminApi.getStipendRecords({ page: '1', ...params }).then((r) => r.meta),
    enabled: !!unlockToken,
    placeholderData: keepPreviousData,
  })

  // Inactivity closes the gate; any pointer/keyboard activity re-arms the timer.
  useEffect(() => {
    if (!unlockToken) return
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setUnlockToken(null), GATE_TIMEOUT_MS)
    }
    reset()
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [unlockToken])

  // An expired/rejected token re-locks the page so the password is re-entered.
  const onMoneyError = (e: ApiError, fallback: string) => {
    const tokenErr = e.response?.data?.errors?.unlock_token?.[0]
    if (tokenErr) { setUnlockToken(null); setUnlockPw(''); setUnlockError(tokenErr); return }
    notifyError(e, fallback)
  }
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-stipend'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stipend-eligible'] })
  }

  const unlock = useMutation({
    mutationFn: () => adminApi.unlockStipend(unlockPw),
    onSuccess: (d) => {
      setUnlockToken(d.unlock_token); setUnlockPw(''); setUnlockError(null)
      notify({ title: 'Stipend unlocked', detail: 'The page locks again after 15 minutes of inactivity.' })
    },
    onError: (e: ApiError) => setUnlockError(e.response?.data?.errors?.password?.[0] ?? e.response?.data?.message ?? 'Could not unlock.'),
  })

  // The password gate: nothing on this page is accessible before unlock.
  if (!unlockToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className={`${CARD} w-full max-w-sm p-6`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-soft text-accent-strong"><Lock className="h-5 w-5" /></span>
          <h1 className="mt-3 text-[20px] font-extrabold text-ink-950">Stipend</h1>
          <p className="mt-1 text-[13px] text-ink-500">Money leaves from this page, so enter your password again. It locks after 15 minutes of inactivity.</p>
          <div className="relative mt-4">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="password" value={unlockPw} onChange={(e) => setUnlockPw(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && unlockPw && !unlock.isPending) unlock.mutate() }}
              placeholder="Your password" aria-label="Your password"
              className="h-11 w-full rounded-xl border border-ink-200 bg-ink-50 pl-9 pr-3 text-sm text-ink-950 focus:border-accent focus:outline-none" />
          </div>
          {unlockError && <p className="mt-2 text-sm text-danger-700">{unlockError}</p>}
          <button onClick={() => unlock.mutate()} disabled={unlock.isPending || !unlockPw}
            className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50">
            {unlock.isPending ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    )
  }

  const shown = eligible.filter((e) => matches(e, filters, q))
  const ready = shown.filter((e) => e.has_signature && e.narrative_submitted)
  const blocked = shown.filter((e) => !(e.has_signature && e.narrative_submitted))
  const filtered = isFiltered(filters)

  return (
    <div className="space-y-[18px] pb-24">
      <div>
        <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Stipend</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">Tick who&apos;s ready, then release. Releasing is final, and each recipient is notified.</p>
      </div>

      {/* Releases are refused server-side without a title — say so up front (same wording as StipendClaimService). */}
      {!user?.position_title && (
        <p className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          Set your position title on your <Link href="/profile" className="font-semibold underline">Profile page</Link> before releasing stipends.
        </p>
      )}

      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-900/[.08]">
        {([['release', 'To release', Wallet, ready.length], ['history', 'History', Receipt, totals?.total]] as const).map(([key, label, Icon, count]) => {
          const on = tab === key
          return (
            <button key={key} role="tab" aria-selected={on} onClick={() => setTab(key)}
              className={`-mb-px flex h-[46px] items-center gap-2 border-b-[3px] px-4 text-[14px] ${on ? 'border-accent font-bold text-ink-950' : 'border-transparent font-semibold text-ink-500 hover:text-ink-800'}`}>
              <Icon className="h-5 w-5" /> {label}
              <span className={`rounded-full px-2 py-px text-xs font-bold ${on ? 'bg-gold-accent text-[#2B2200]' : 'bg-surface-3 text-ink-600'}`}>{count ?? '·'}</span>
            </button>
          )
        })}
      </div>

      <FilterBar filters={filters} onChange={setFilters} terms={totals?.terms ?? []} />

      {tab === 'release'
        ? <ReleaseTab ready={ready} blocked={blocked} loading={eligibleLoading} unlockToken={unlockToken} onDone={invalidate} onMoneyError={onMoneyError}
            filtered={filtered} onClearFilters={() => setFilters(NO_FILTERS)} />
        : <HistoryTab params={params} unlockToken={unlockToken} onDone={invalidate} onMoneyError={onMoneyError} />}
    </div>
  )
}

// ── To release ─────────────────────────────────────────────────────────────

function ReleaseTab({ ready, blocked, loading, unlockToken, onDone, onMoneyError, filtered, onClearFilters }: {
  ready: EligibleStipend[]
  blocked: EligibleStipend[]
  loading: boolean
  unlockToken: string
  onDone: () => void
  onMoneyError: (e: ApiError, fallback: string) => void
  /** A filter is on: Select all / Remind all act on the rows shown only. */
  filtered: boolean
  onClearFilters: () => void
}) {
  const { notify, notifyError } = useFeedback()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [bulk, setBulk] = useState('')
  const [showBlocked, setShowBlocked] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [reminded, setReminded] = useState<Record<number, 'sent' | 'today'>>({})

  // Forget selections that left the list (released, or no longer eligible).
  useEffect(() => {
    const keys = new Set(ready.map(keyOf))
    setSelected((s) => new Set([...s].filter((k) => keys.has(k))))
  }, [ready])

  const amountOf = (e: EligibleStipend) => { const v = amounts[keyOf(e)]; return v === undefined ? e.suggested_amount : toNumber(v) }
  const picked = ready.filter((e) => selected.has(keyOf(e)))
  const total = picked.reduce((a, e) => a + (amountOf(e) || 0), 0)
  const badAmount = picked.some((e) => !(amountOf(e) > 0))
  const allOn = ready.length > 0 && picked.length === ready.length
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const applyBulk = () => {
    const n = toNumber(bulk)
    if (!picked.length || !(n > 0)) return
    setAmounts((a) => ({ ...a, ...Object.fromEntries(picked.map((e) => [keyOf(e), String(n)])) }))
    setBulk('')
    notify({ title: `Amount set for ${picked.length} selected`, detail: null })
  }

  const release = useMutation({
    mutationFn: () => adminApi.releaseBulkStipend({
      unlock_token: unlockToken,
      items: picked.map((e) => ({
        user_id: e.user_id, amount: amountOf(e), academic_year: e.academic_year, semester: e.semester,
        remarks: remarks.trim() || DEFAULT_REMARKS,
      })),
    }),
    onSuccess: (res) => {
      onDone()
      const count = res.data.released.length
      const sum = res.data.released.reduce((a, r) => a + Number(r.amount), 0)
      const nameOf = (id: number) => ready.find((e) => e.user_id === id)?.name ?? `User #${id}`
      setConfirming(false); setRemarks(''); setSelected(new Set()); setAmounts({})
      notify({
        tone: count ? 'success' : 'error',
        title: count ? `${peso(sum)} released to ${count} ${count === 1 ? 'recipient' : 'recipients'}` : 'Nothing was released',
        detail: [
          count ? 'Each recipient is notified; their signed stub is on their Stipend page.' : '',
          ...res.data.skipped.map((sk) => `Skipped ${nameOf(sk.user_id)}: ${sk.reason}`),
        ].filter(Boolean).join('\n'),
      })
    },
    onError: (e: ApiError) => { setConfirming(false); onMoneyError(e, 'Could not release the selected stipends') },
  })

  const remind = useMutation({
    mutationFn: (ids?: number[]) => adminApi.remindStipend(ids),
    onSuccess: (r, ids) => {
      const targets = ids ?? blocked.map((e) => e.user_id)
      setReminded((m) => ({ ...m, ...Object.fromEntries(targets.map((id) => [id, 'sent' as const])) }))
      notify(r.reminded
        ? { title: `Reminded ${r.reminded} ${r.reminded === 1 ? 'recipient' : 'recipients'}`, detail: `They got a bell notification and an email saying what's missing.${r.already_today ? ` ${r.already_today} already reminded today.` : ''}` }
        : { tone: 'info', title: 'Already reminded today', detail: 'Each recipient is reminded at most once a day.' })
      if (!r.reminded && ids?.length === 1) setReminded((m) => ({ ...m, [ids[0]]: 'today' }))
    },
    onError: (e) => notifyError(e, 'Could not send the reminder'),
  })

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Ready */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-900/[.05] px-5 py-4">
          <CheckBox state={allOn ? 'on' : picked.length ? 'some' : 'off'} label="Select all"
            onClick={() => setSelected(allOn ? new Set() : new Set(ready.map(keyOf)))} disabled={!ready.length} />
          <div className="min-w-[200px] flex-1">
            <p className="text-[15px] font-bold text-ink-950">Ready to release</p>
            <p className="mt-px text-[12.5px] text-ink-500">Hours done, signature saved and end-of-term report in. Click an amount to change it.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-500">Set selected to</span>
            <span className="flex h-[34px] items-center gap-1 rounded-[9px] border border-ink-200 bg-surface pl-2.5 pr-1">
              <span className="text-[13px] font-bold text-ink-600">₱</span>
              <input value={bulk} onChange={(e) => setBulk(e.target.value)} inputMode="decimal" aria-label="Amount for the selected"
                onKeyDown={(e) => { if (e.key === 'Enter') applyBulk() }}
                className="w-[70px] border-none bg-transparent text-right text-[13px] font-bold text-ink-950 focus:outline-none" />
            </span>
            <button onClick={applyBulk} disabled={!picked.length || !(toNumber(bulk) > 0)}
              className="h-[34px] rounded-[9px] bg-accent px-3 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:bg-accent-muted">Apply</button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-100" />)}</div>
        ) : ready.length === 0 ? (
          filtered ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-ink-500">
              No one matches these filters.{' '}
              <button type="button" onClick={onClearFilters} className="font-semibold text-accent-strong hover:underline">Clear filters</button>
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 px-5 py-10 text-[13.5px] text-ink-500"><CheckCircle2 className="h-5 w-5 text-accent" /> No one is ready to release.</p>
          )
        ) : ready.map((e) => {
          const k = keyOf(e)
          const on = selected.has(k)
          const v = amountOf(e)
          const bad = !(v > 0)
          const changed = !bad && v !== e.suggested_amount
          return (
            <div key={k} onClick={() => toggle(k)} role="button" tabIndex={0} aria-pressed={on}
              onKeyDown={(ev) => { if (ev.key === ' ' && ev.target === ev.currentTarget) { ev.preventDefault(); toggle(k) } }}
              className={`flex cursor-pointer flex-wrap items-center gap-3.5 border-b border-ink-900/[.04] px-5 py-[13px] last:border-0 ${on ? 'bg-accent-tint' : 'hover:bg-surface-2'}`}>
              <CheckBox state={on ? 'on' : 'off'} label={`Select ${e.name}`} />
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-accent-deep">{initials(e.name)}</span>
              <div className="min-w-[180px] flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink-950">{e.name}</span>
                  {e.student_id_number && <span className="text-[11.5px] text-ink-400">ID {e.student_id_number}</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span>{e.semester} {e.academic_year} · {e.verified_hours}/{e.required_hours}h verified</span>
                  {e.via_promissory && <span className="rounded-md bg-gold-100 px-2 py-px text-[11px] font-bold text-gold-700">Promissory · short {shortHours(e)}h</span>}
                </p>
              </div>
              <div onClick={(ev) => ev.stopPropagation()}
                className={`flex h-9 flex-none items-center gap-1 rounded-[10px] border bg-surface pl-2.5 pr-1 ${bad ? 'border-red-accent' : changed ? 'border-gold-accent' : 'border-ink-200'}`}>
                <span className="text-[14px] font-extrabold text-ink-600">₱</span>
                <input value={amounts[k] ?? e.suggested_amount.toLocaleString('en-PH')} inputMode="decimal" aria-label={`Amount for ${e.name}`}
                  onChange={(ev) => setAmounts((a) => ({ ...a, [k]: ev.target.value }))}
                  className="w-[84px] border-none bg-transparent text-right text-[14.5px] font-extrabold text-ink-950 focus:outline-none" />
                {bad ? <span title="Enter an amount above 0" className="flex w-6 justify-center text-red-accent"><AlertCircle className="h-4 w-4" /></span>
                  : changed ? (
                    <button type="button" title={`Back to ${peso(e.suggested_amount)}`} aria-label="Reset the amount"
                      onClick={() => setAmounts((a) => { const n = { ...a }; delete n[k]; return n })}
                      className="flex w-6 justify-center text-gold-700"><Undo2 className="h-4 w-4" /></button>
                  ) : <span className="flex w-6 justify-center text-ink-350"><Pencil className="h-3.5 w-3.5" /></span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Blocked */}
      {blocked.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <button onClick={() => setShowBlocked((s) => !s)} aria-expanded={showBlocked} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-danger-100 text-red-strong"><Ban className="h-[19px] w-[19px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-ink-950">Can&apos;t release yet · {blocked.length}</span>
                <span className="mt-px block text-[12.5px] text-ink-500">Something is missing. Ask the student to finish it.</span>
              </span>
              {showBlocked ? <ChevronUp className="h-5 w-5 text-ink-500" /> : <ChevronDown className="h-5 w-5 text-ink-500" />}
            </button>
            <button onClick={() => remind.mutate(filtered ? [...new Set(blocked.map((e) => e.user_id))] : undefined)} disabled={remind.isPending}
              className="flex h-8 flex-none items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-3 text-xs font-semibold text-ink-700 hover:border-accent hover:text-accent-strong disabled:opacity-50">
              <BellRing className="h-4 w-4" /> {filtered ? 'Remind these' : 'Remind all'}
            </button>
          </div>
          {showBlocked && blocked.map((e) => {
            const state = reminded[e.user_id]
            return (
              <div key={keyOf(e)} className="flex flex-wrap items-center gap-3.5 border-t border-ink-900/[.04] px-5 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-ink-400">{initials(e.name)}</span>
                <div className="min-w-[160px] flex-1">
                  <p className="text-[13.5px] font-semibold text-ink-600">{e.name}{e.student_id_number && <span className="ml-1.5 text-[11.5px] font-normal text-ink-400">ID {e.student_id_number}</span>}</p>
                  <p className="mt-px text-xs text-ink-400">{e.semester} {e.academic_year} · {e.verified_hours}/{e.required_hours}h verified</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {!e.has_signature && <Missing icon={PenLine} label="No signature" />}
                  {!e.narrative_submitted && <Missing icon={FileText} label="No end-of-term report" />}
                  {e.via_promissory && <Missing icon={NotebookPen} label={`Promissory · short ${shortHours(e)}h`} gold />}
                </div>
                <button onClick={() => remind.mutate([e.user_id])} disabled={remind.isPending || !!state}
                  title="Bell notification + email saying what's missing (once a day)"
                  className="flex h-8 flex-none items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-3 text-xs font-semibold text-ink-700 hover:border-accent hover:text-accent-strong disabled:opacity-60">
                  {state ? <Check className="h-4 w-4 text-accent" /> : <BellRing className="h-4 w-4" />} {state === 'today' ? 'Reminded today' : state ? 'Reminded' : 'Remind'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom bar */}
      {picked.length > 0 && (
        <div className="fixed bottom-[22px] left-1/2 z-40 flex w-[min(720px,calc(100%-32px))] -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl bg-accent-deep py-3 pl-5 pr-3 text-white shadow-[0_12px_32px_rgba(6,61,39,.35)] print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">{picked.length} selected · {peso(total)}</p>
            <p className="text-xs text-white/70">Stubs are signed and each recipient is notified.</p>
          </div>
          <button onClick={() => setSelected(new Set())} className="h-[42px] rounded-[11px] border border-white/25 px-3.5 text-[13px] font-semibold hover:bg-white/10">Clear</button>
          <button onClick={() => badAmount ? notify({ tone: 'error', title: 'Fix the amounts marked in red first', detail: null }) : setConfirming(true)}
            className="btn-gold flex h-[42px] items-center gap-1.5 rounded-[11px] px-[18px] text-[14px] font-bold">
            <Wallet className="h-[18px] w-[18px]" /> Release
          </button>
        </div>
      )}

      {/* Confirm */}
      {confirming && (
        <Dialog onClose={() => !release.isPending && setConfirming(false)} label="Release stipends">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gold-100 text-gold-700"><Wallet className="h-6 w-6" /></span>
          <p className="mt-3.5 text-[19px] font-extrabold text-ink-950">Release {peso(total)} to {picked.length} {picked.length === 1 ? 'recipient' : 'recipients'}?</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">This can&apos;t be undone. You can only void a stub afterwards.</p>
          <div className="mt-3.5 flex max-h-[170px] flex-col gap-1.5 overflow-auto rounded-xl bg-surface-2 px-3 py-2.5">
            {picked.map((e) => (
              <div key={keyOf(e)} className="flex justify-between gap-2.5 text-[13px]">
                <span className="text-ink-800">{e.name}</span>
                <span className="flex items-baseline gap-1.5">
                  {amountOf(e) !== e.suggested_amount && <span className="text-[11.5px] text-ink-400 line-through">{peso(e.suggested_amount)}</span>}
                  <strong className="text-ink-950">{peso(amountOf(e))}</strong>
                </span>
              </div>
            ))}
          </div>
          <label className="mt-3.5 block">
            <span className="text-xs font-semibold text-ink-600">Remarks on the stubs <span className="font-normal text-ink-400">(optional)</span></span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder={DEFAULT_REMARKS}
              className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3 text-[13.5px] text-ink-950 focus:border-accent focus:outline-none" />
          </label>
          <div className="mt-5 flex justify-end gap-2.5">
            <button onClick={() => setConfirming(false)} disabled={release.isPending} className="h-11 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-700">Cancel</button>
            <button onClick={() => release.mutate()} disabled={release.isPending}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60">
              {release.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Yes, release
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

// ── History ────────────────────────────────────────────────────────────────

function HistoryTab({ params, unlockToken, onDone, onMoneyError }: {
  /** The shared filters (term, college, promissory, search) as query params. */
  params: Record<string, string>
  unlockToken: string
  onDone: () => void
  onMoneyError: (e: ApiError, fallback: string) => void
}) {
  const { notify } = useFeedback()
  const [chip, setChip] = useState<Chip>('all')
  const [sort, setSort] = useState<Sort>('new')
  const [page, setPage] = useState(1)
  const [voiding, setVoiding] = useState<StipendRecord | null>(null)
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<{ id: number; label: string } | null>(null)

  // Back to page 1 whenever the filters change.
  const paramsKey = JSON.stringify(params)
  useEffect(() => { setPage(1) }, [paramsKey])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stipend', page, chip, sort, params],
    queryFn: () => adminApi.getStipendRecords({
      page: String(page), ...params, ...(chip !== 'all' && { status: chip }), ...(sort !== 'new' && { sort }),
    }),
    placeholderData: keepPreviousData,
  })
  const records = data?.data ?? []
  const s = data?.meta.summary
  const lastPage = data?.meta.last_page ?? 1

  const voidStub = useMutation({
    mutationFn: () => adminApi.voidStipend(voiding!.id, reason.trim(), { unlock_token: unlockToken }),
    onSuccess: () => {
      onDone(); setVoiding(null); setReason('')
      notify({ title: 'Stub voided', detail: 'The stub now prints VOID, and the recipient can be released a new one.' })
    },
    onError: (e: ApiError) => { setVoiding(null); onMoneyError(e, 'Could not void the stub') },
  })

  // Received = the recipient opened (viewed or downloaded) the stub; old Banking Office pickups count too.
  const chips: [Chip, string, number | undefined][] = [
    ['all', 'All', s ? s.released + s.void : undefined],
    ['released', 'Released', s?.released],
    ['received', 'Received', s?.received],
    ['not_received', 'Not yet opened', s?.not_received],
    ['void', 'Void', s?.void],
  ]

  return (
    <div className="flex flex-col gap-3.5">
      <div className="stagger grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[
          { label: 'Paid out', value: s ? <CountUp value={Number(s.paid_out)} format={peso} /> : '—', hint: 'every stub not voided', color: 'var(--color-accent)' },
          { label: 'Released', value: s ? <CountUp value={s.released} /> : '—', hint: s ? `${s.received} received · ${s.not_received} not yet opened` : 'final; the recipient was notified', color: 'var(--color-gold-accent)' },
          { label: 'Voided', value: s ? <CountUp value={s.void} /> : '—', hint: 'cancelled stubs', color: 'var(--color-red-accent)' },
        ].map((k) => (
          <div key={k.label} className={`${CARD} px-[18px] py-4`}>
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-600"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: k.color }} />{k.label}</p>
            <p className="mt-2 text-[24px] font-extrabold text-ink-950">{k.value}</p>
            <p className="mt-0.5 text-xs text-ink-500">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-900/[.05] px-[18px] py-3.5">
          {chips.map(([key, label, count]) => {
            const on = chip === key
            return (
              <button key={key} onClick={() => { setChip(key); setPage(1) }} aria-pressed={on}
                className={`flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold ${on ? 'border-accent-deep bg-accent-deep text-white' : 'border-ink-200 bg-surface text-ink-700'}`}>
                {label}<span className="font-extrabold">{count ?? '·'}</span>
              </button>
            )
          })}
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink-500">
            <ArrowUpDown className="h-4 w-4" /> Sort
            <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1) }} aria-label="Sort stipend records" className={SELECT}>
              <option value="new">Newest released</option>
              <option value="old">Oldest released</option>
              <option value="amount">Amount, high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          {/* Every row these filters show (not just this page), as a spreadsheet. */}
          <ExportButtons formats={['csv']} fallbackName="stipend-history" disabled={!data?.meta.total}
            summary={data ? `${data.meta.total} ${data.meta.total === 1 ? 'stub' : 'stubs'}` : undefined}
            download={() => adminApi.exportStipend({ ...params, ...(chip !== 'all' && { status: chip }), ...(sort !== 'new' && { sort }) })} />
        </div>

        <div className="overflow-x-auto">
          <div className="sm:min-w-[820px]">
            <div className="hidden grid-cols-[minmax(200px,1.5fr)_minmax(170px,1.2fr)_110px_minmax(150px,1fr)_minmax(150px,1fr)_84px] gap-3.5 sm:grid bg-surface-2 px-[18px] py-2.5 text-xs font-bold text-ink-500">
              <span>Recipient</span><span>Control no.</span><span className="text-right">Amount</span><span>Period</span><span>Status</span><span />
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">{[1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}</div>
            ) : records.length === 0 ? (
              <p className="px-5 py-9 text-center text-[13.5px] text-ink-500">No stipends match.</p>
            ) : records.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.released
              const isVoid = r.status === 'void'
              return (
                <div key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-900/[.04] px-4 py-3 sm:grid sm:grid-cols-[minmax(200px,1.5fr)_minmax(170px,1.2fr)_110px_minmax(150px,1fr)_minmax(150px,1fr)_84px] sm:gap-3.5 sm:px-[18px] hover:bg-surface-2 ${isVoid ? 'opacity-70' : ''}`}>
                  <div className="order-1 w-[calc(100%-7rem)] min-w-0 sm:order-none sm:w-auto">
                    <p className="truncate text-[13.5px] font-semibold text-ink-950">{r.recipient?.name ?? `User #${r.user_id}`}</p>
                    <p className="text-[11.5px] text-ink-400">{r.recipient?.profile?.student_id_number ? `ID ${r.recipient.profile.student_id_number}` : '—'}</p>
                  </div>
                  <span className="order-3 truncate font-mono text-xs text-ink-600 sm:order-none">{r.control_number ?? '—'}</span>
                  <span className="order-2 ml-auto text-right text-[13.5px] font-bold text-ink-950 sm:order-none sm:ml-0">{peso(Number(r.amount))}</span>
                  <span className="order-4 text-[12.5px] text-ink-600 sm:order-none">{r.semester} {r.academic_year}</span>
                  <div className="order-5 w-full min-w-0 sm:order-none sm:w-auto">
                    <p className="flex items-center gap-1.5">
                      <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                      {!isVoid && r.released_at && <span className="text-[11.5px] text-ink-400">{formatDate(r.released_at)}</span>}
                    </p>
                    {!isVoid && (r.received_at
                      ? <p className="mt-1 text-[11.5px] font-semibold text-info-700" title="The recipient opened the stub">Received {formatDate(r.received_at)}</p>
                      : <p className="mt-1 text-[11.5px] text-ink-400" title="The recipient hasn't viewed or downloaded it yet">Not yet opened</p>)}
                    {isVoid && r.void_reason && <p className="mt-1 truncate text-[11.5px] text-red-strong" title={r.void_reason}>{r.void_reason}</p>}
                    {!isVoid && r.via_promissory && <p className="mt-1 truncate text-[11.5px] text-gold-700">Promissory · short {r.deficient_hours ?? '—'}h</p>}
                  </div>
                  <div className="order-6 ml-auto flex justify-end gap-1.5 sm:order-none">
                    <button onClick={() => setHistory({ id: r.id, label: r.control_number ?? `#${r.id}` })} title="See history" aria-label={`History of ${r.control_number ?? r.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-ink-200 bg-surface text-ink-600 hover:border-accent hover:text-accent-strong">
                      <History className="h-4 w-4" />
                    </button>
                    {canVoid(r.status) && (
                      <button onClick={() => { setVoiding(r); setReason('') }} title="Void" aria-label={`Void ${r.control_number ?? r.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-danger-200 bg-surface text-red-strong hover:bg-danger-50">
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-ink-900/[.05] py-3 text-sm">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-600 disabled:opacity-40">Previous</button>
            <span className="text-ink-500">Page {page} of {lastPage}</span>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-600 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {voiding && (
        <Dialog onClose={() => !voidStub.isPending && setVoiding(null)} label="Void stub">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-danger-100 text-red-strong"><Ban className="h-6 w-6" /></span>
          <p className="mt-3.5 text-[19px] font-extrabold text-ink-950">Void {(voiding.recipient?.name ?? 'this recipient').split(' ')[0]}&apos;s stub?</p>
          <p className="mt-1.5 text-[13.5px] text-ink-600">
            {voiding.control_number ?? 'No control number'} · {peso(Number(voiding.amount))}. The stub prints VOID and the recipient becomes eligible again. Tell them why.
          </p>
          {voiding.received_at && (
            <p className="mt-2.5 rounded-xl bg-gold-50 px-3 py-2 text-[12.5px] font-medium text-gold-800">
              They already received it on {formatDate(voiding.received_at)}: make sure the money is settled before voiding.
            </p>
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus
            placeholder="Reason (required), e.g. issued with the wrong amount"
            className="mt-3.5 w-full resize-y rounded-xl border border-ink-200 bg-surface px-3.5 py-3 text-[13.5px] text-ink-950 focus:border-accent focus:outline-none" />
          <div className="mt-4 flex justify-end gap-2.5">
            <button onClick={() => setVoiding(null)} disabled={voidStub.isPending} className="h-11 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-700">Cancel</button>
            <button onClick={() => voidStub.mutate()} disabled={!reason.trim() || voidStub.isPending}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-red-accent px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
              {voidStub.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Void stub
            </button>
          </div>
        </Dialog>
      )}

      {history && (
        <AuditHistoryDrawer scope={{ record: `stipend:${history.id}` }} title={`History · Stipend ${history.label}`} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}

// ── Small pieces ───────────────────────────────────────────────────────────

const SELECT = 'h-[38px] max-w-full rounded-[10px] border border-ink-200 bg-surface px-2.5 text-[13px] font-medium text-ink-900 focus:border-accent focus:outline-none'

/** Term, college, promissory only and search — shared by To release and History. */
function FilterBar({ filters, onChange, terms }: { filters: Filters; onChange: (f: Filters) => void; terms: StipendTerm[] }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  // Keep a chosen term listed even before the options load.
  const options = filters.term && !terms.some((t) => `${t.academic_year}|${t.semester}` === filters.term)
    ? [{ academic_year: filters.term.split('|')[0], semester: filters.term.split('|')[1] }, ...terms]
    : terms

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink-500">
        <CalendarRange className="h-4 w-4 flex-none" />
        <select value={filters.term} onChange={(e) => set({ term: e.target.value })} aria-label="Term" className={SELECT}>
          <option value="">All terms</option>
          {options.map((t) => {
            const v = `${t.academic_year}|${t.semester}`
            return <option key={v} value={v}>{t.semester} {t.academic_year}</option>
          })}
        </select>
      </label>
      <select value={filters.college} onChange={(e) => set({ college: e.target.value })} aria-label="College" className={`${SELECT} w-[230px]`}>
        <option value="">All colleges</option>
        {COLLEGES.map((c) => <option key={c.value} value={c.value}>{collegeDisplay(c.value)}</option>)}
      </select>
      <button type="button" onClick={() => set({ promissory: !filters.promissory })} aria-pressed={filters.promissory}
        className={`flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold ${filters.promissory ? 'border-gold-accent bg-gold-100 text-gold-700' : 'border-ink-200 bg-surface text-ink-700'}`}>
        <NotebookPen className="h-4 w-4" /> Promissory only
      </button>
      <div className="flex h-[38px] w-[260px] max-w-full items-center gap-2 rounded-[10px] bg-surface-2 px-3 sm:ml-auto">
        <Search className="h-[18px] w-[18px] flex-none text-ink-400" />
        <input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="Name, ID or control no." aria-label="Search stipends"
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-950 focus:outline-none" />
        {filters.search && <button onClick={() => set({ search: '' })} aria-label="Clear search" className="text-ink-400"><X className="h-4 w-4" /></button>}
      </div>
      {isFiltered(filters) && (
        <button type="button" onClick={() => onChange(NO_FILTERS)} className="text-[12.5px] font-semibold text-accent-strong hover:underline">Clear filters</button>
      )}
    </div>
  )
}

function CheckBox({ state, label, onClick, disabled }: { state: 'on' | 'some' | 'off'; label: string; onClick?: () => void; disabled?: boolean }) {
  const filled = state !== 'off'
  const box = (
    <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-2 text-white ${filled ? 'border-accent bg-accent' : 'border-ink-300 bg-surface'}`}>
      {state === 'on' ? <Check className="h-4 w-4" strokeWidth={3} /> : state === 'some' ? <Minus className="h-4 w-4" strokeWidth={3} /> : null}
    </span>
  )
  if (!onClick) return <span role="checkbox" aria-checked={state === 'on'} aria-label={label}>{box}</span>
  return (
    <button type="button" role="checkbox" aria-checked={state === 'on' ? true : state === 'some' ? 'mixed' : false} aria-label={label}
      onClick={onClick} disabled={disabled} className="disabled:opacity-40">{box}</button>
  )
}

function Missing({ icon: Icon, label, gold }: { icon: typeof PenLine; label: string; gold?: boolean }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ${gold ? 'bg-gold-100 text-gold-700' : 'bg-danger-100 text-red-strong'}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  )
}

function Dialog({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,30,20,.45)] p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full rounded-[20px] bg-surface p-[26px] shadow-[0_20px_60px_rgba(0,0,0,.3)]">
        {children}
      </div>
    </div>
  )
}
