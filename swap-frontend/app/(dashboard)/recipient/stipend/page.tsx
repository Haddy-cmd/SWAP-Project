'use client'

import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt, Download, Eye, Loader2, Clock, PenLine, ClipboardCheck, Wallet, HandCoins, Check, ArrowRight,
  FileSignature, Lock, Info, ChevronDown, ChevronUp, Upload, FileText,
} from 'lucide-react'
import { stipendApi } from '@/lib/api/stipend.api'
import { promissoryApi } from '@/lib/api/promissory.api'
import { attendanceApi } from '@/lib/api/attendance.api'
import { formatDate } from '@/lib/utils/formatDate'
import type { StipendRecord } from '@/types/analytics.types'
import type { PromissoryStatus } from '@/types/promissory.types'
import type { RecipientProgress } from '@/types/attendance.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { CountUp } from '@/components/ui/CountUp'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const peso = (n: number) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

const PROMISSORY: Record<PromissoryStatus, { label: string; fg: string; bg: string }> = {
  pending: { label: 'Waiting for your supervisor', fg: 'var(--text-gold-700)', bg: 'var(--color-gold-100)' },
  approved: { label: 'Approved', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  rejected: { label: 'Rejected', fg: 'var(--text-red-strong)', bg: 'var(--color-danger-100)' },
}

type Step = { key: string; label: string; note: string; Icon: ComponentType<{ className?: string }>; done: boolean }

/**
 * Recipient → My Stipend (layout "SWAP Recipient Stipend v2"): where this semester's stipend
 * is (hours → signature → report → released → received), every stub with View / Download —
 * opening one is what marks it received for the DSA — and the promissory note for a short term.
 */
export default function StipendPage() {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [busy, setBusy] = useState<{ id: number; how: 'view' | 'download' } | null>(null)

  const { data: history = [], isLoading } = useQuery({ queryKey: ['stipend-history'], queryFn: () => stipendApi.getHistory() })
  const { data: progress } = useQuery({ queryKey: ['recipient-progress'], queryFn: () => attendanceApi.getProgress() })
  const { data: summary } = useQuery({ queryKey: ['hours-summary'], queryFn: () => attendanceApi.getHoursSummary() })
  const { data: assignment } = useQuery({ queryKey: ['recipient-assignment'], queryFn: () => attendanceApi.getMyAssignment() })

  const live = history.filter((s) => s.status !== 'void')
  const totalReceived = live.reduce((sum, s) => sum + Number(s.amount || 0), 0)
  // This semester's live stub, if the DSA released it.
  const termStub = assignment
    ? live.find((s) => s.academic_year === assignment.academic_year && s.semester === assignment.semester) ?? null
    : null

  /** View in a new tab, or download — either one marks the stub received (server side). */
  async function open(s: StipendRecord, how: 'view' | 'download') {
    // Open the tab now (inside the click), so pop-up blockers allow it; fill it when the PDF arrives.
    const tab = how === 'view' ? window.open('', '_blank') : null
    setBusy({ id: s.id, how })
    try {
      const blob = await stipendApi.getSlip(s.id, `${s.status}-${s.released_at ?? s.certified_at ?? s.created_at}`, { view: how === 'view' })
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      if (tab) {
        tab.location.href = url
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `swap-stipend-stub-${s.control_number ?? s.id}.pdf`
        document.body.appendChild(a); a.click(); a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      if (!s.received_at) {
        qc.invalidateQueries({ queryKey: ['stipend-history'] })
        notify({ title: 'Stub received', detail: 'The DSA can see you have your stub. Keep it for your records.' })
      }
    } catch (e) {
      tab?.close()
      // The request asked for a Blob, so the API's JSON error arrives as one: read its message.
      let message = 'Could not open the stub.'
      const data = (e as { response?: { data?: unknown } }).response?.data
      if (data instanceof Blob) {
        try { message = (JSON.parse(await data.text()) as { message?: string }).message ?? message } catch { /* keep generic */ }
      }
      notifyError({ message }, 'Could not open the stub')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[24px] sm:text-[30px] font-medium leading-tight text-ink-950">My Stipend</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">See where your stipend is and download your signed stubs.</p>
        </div>
        <div className="flex gap-6">
          {([['Received so far', <CountUp key="r" value={totalReceived} format={peso} />], ['Stubs', <CountUp key="s" value={live.length} />]] as const).map(([k, v]) => (
            <div key={k} className="text-left sm:text-right">
              <p className="text-xs text-ink-500">{k}</p>
              <p className="text-[20px] font-extrabold text-ink-950">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <Hero progress={progress} hours={summary} hasPlacement={!!assignment} stub={termStub}
        term={assignment ? `${assignment.semester} ${assignment.academic_year}` : progress?.term ?? null}
        onOpenStub={() => termStub && open(termStub, 'view')} />

      {/* Stubs */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline gap-2 border-b border-ink-900/[.05] px-[22px] py-4">
          <span className="text-[15px] font-bold text-ink-950">My stubs</span>
          <span className="text-[12.5px] text-ink-500">Signed by your supervisor, the director and you</span>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{[1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-100" />)}</div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-surface-3 text-ink-400"><Receipt className="h-6 w-6" /></span>
            <p className="text-[14px] font-semibold text-ink-800">No stubs yet</p>
            <p className="text-[12.5px] text-ink-500">They appear here when the DSA releases your stipend.</p>
          </div>
        ) : history.map((s) => {
          const isVoid = s.status === 'void'
          const received = !isVoid && !!s.received_at
          const pill = isVoid ? { label: 'Void', fg: 'var(--text-red-strong)', bg: 'var(--color-danger-100)' }
            : received ? { label: 'Received', fg: 'var(--text-info-700)', bg: 'var(--color-info-100)' }
            : { label: 'Released', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' }
          const released = s.released_at ?? s.certified_at
          return (
            <div key={s.id} className={`flex flex-wrap items-center gap-4 border-b border-ink-900/[.04] px-[22px] py-4 last:border-0 ${isVoid ? 'opacity-75' : ''}`}>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: isVoid ? 'var(--color-danger-50)' : 'var(--color-accent-soft)', color: isVoid ? 'var(--text-red-strong)' : 'var(--text-accent-strong)' }}>
                <Receipt className="h-[22px] w-[22px]" />
              </span>
              <div className="min-w-[200px] flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={`text-[18px] font-extrabold text-ink-950 ${isVoid ? 'line-through' : ''}`}>{peso(Number(s.amount))}</span>
                  <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ color: pill.fg, background: pill.bg }}>{pill.label}</span>
                  {s.via_promissory && <span className="rounded-full bg-gold-100 px-2 py-[3px] text-[11px] font-bold text-gold-700">Promissory · short {s.deficient_hours ?? '—'}h</span>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  {[s.period_label, `${s.semester} ${s.academic_year}`].filter(Boolean).join(' · ')}
                  {!isVoid && released ? ` · Released ${day(released)}` : ''}
                  {received ? ` · received ${day(s.received_at)}` : ''}
                </p>
                {isVoid && s.void_reason && <p className="mt-0.5 text-xs text-red-strong">Void: {s.void_reason}</p>}
                {s.control_number && <p className="mt-0.5 font-mono text-[11.5px] text-ink-400">{s.control_number}</p>}
              </div>
              {!isVoid && s.has_slip && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => open(s, 'view')} disabled={!!busy}
                    className="flex h-10 items-center gap-1.5 rounded-[11px] border border-ink-200 bg-surface px-3.5 text-[13px] font-semibold text-ink-700 hover:border-accent disabled:opacity-60">
                    {busy?.id === s.id && busy.how === 'view' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} View
                  </button>
                  <button onClick={() => open(s, 'download')} disabled={!!busy}
                    className="flex h-10 items-center gap-1.5 rounded-[11px] border border-ink-200 bg-surface px-3.5 text-[13px] font-semibold text-accent-strong hover:border-accent disabled:opacity-60">
                    {busy?.id === s.id && busy.how === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download stub
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <PromissoryCard />
    </div>
  )
}

// ── This semester ───────────────────────────────────────────────────────────

function Hero({ progress, hours, hasPlacement, stub, term, onOpenStub }: {
  progress: RecipientProgress | null | undefined
  hours: { verified: number; required: number; remaining: number } | undefined
  hasPlacement: boolean
  stub: StipendRecord | null
  term: string | null
  onOpenStub: () => void
}) {
  const item = (k: string) => progress?.checklist.find((c) => c.key === k)
  const hoursItem = item('hours'), sig = item('signature'), rep = item('report')
  const hoursDone = hoursItem?.state === 'done'
  const viaNote = hoursDone && !!hours && hours.remaining > 0
  const sigDone = sig?.state === 'done'
  const repIn = !!rep && rep.state !== 'todo'
  const repAccepted = rep?.state === 'done' || rep?.state === 'blocked'
  const released = !!stub
  const received = !!stub?.received_at

  const steps: Step[] = [
    { key: 'hours', label: 'Finish hours', Icon: Clock, done: hoursDone,
      note: viaNote ? 'Covered by your promissory note' : hours ? `${Math.round(hours.verified * 10) / 10}h of ${hours.required}h` : '—' },
    { key: 'sig', label: 'Signature saved', Icon: PenLine, done: sigDone, note: sigDone ? 'On your Profile' : 'Save it on your Profile' },
    { key: 'report', label: 'Report in', Icon: ClipboardCheck, done: repIn,
      note: !repIn ? 'Not submitted' : repAccepted ? 'Submitted · accepted' : 'Submitted · waiting for your supervisor' },
    { key: 'released', label: 'Released', Icon: Wallet, done: released, note: released ? day(stub?.released_at ?? stub?.certified_at) : 'By the DSA' },
    { key: 'received', label: 'Received', Icon: HandCoins, done: received, note: received ? day(stub?.received_at) : 'When you open your stub' },
  ]
  const current = steps.findIndex((s) => !s.done)

  const left = hours ? Math.max(0, Math.round((hours.required - hours.verified) * 10) / 10) : 0
  const amount = stub ? peso(Number(stub.amount)) : 'your'
  const state: { title: string; text: string; cta?: { label: string; href?: string; onClick?: () => void } } = !hasPlacement
    ? { title: 'No stipend this semester yet', text: 'Your stipend starts once the DSA places you in an office and you render your hours.' }
    : received ? { title: 'Received', text: `You opened your ${amount} stub on ${day(stub?.received_at)}. Keep it for your records.`, cta: { label: 'View stub', onClick: onOpenStub } }
    : released ? { title: 'Released: open your stub', text: `The DSA released ${amount}. Viewing or downloading the stub marks it received.`, cta: { label: 'View stub', onClick: onOpenStub } }
    : !hoursDone ? {
        title: hoursItem?.state === 'waiting' ? 'Promissory note under review' : `${left} more hours before your stipend`,
        text: hoursItem?.label && hoursItem.state !== 'todo' ? `${hoursItem.label}.` : `Finish your ${hours?.required ?? ''} verified hours and submit your end-of-term report. Then the DSA can release your stipend.`,
        cta: { label: hoursItem?.link === '/recipient/stipend' ? 'File a promissory note' : 'See my hours', href: hoursItem?.link === '/recipient/stipend' ? '#promissory' : '/recipient/attendance' } }
    : !sigDone ? { title: 'Save your signature to get paid', text: 'Your stub is signed with your saved signature. Draw it once on your Profile.', cta: { label: 'Open Profile', href: '/profile' } }
    // The report item carries a link only once it can be submitted (hours done, or the semester ended).
    : !repIn && !rep?.link ? { title: 'Your report opens once your hours are complete', text: 'Then submit your end-of-term report so the DSA can release your stipend.' }
    : !repIn ? { title: 'Submit your end-of-term report', text: 'The DSA can’t release your stipend until your report is in.', cta: { label: 'Write my report', href: '/recipient/attendance#report' } }
    : { title: 'Ready: waiting for the DSA to release it', text: 'Everything is in. You’ll be notified when your stipend is released.' }

  return (
    <div className="relative flex flex-col gap-[22px] overflow-hidden rounded-[20px] px-4 py-5 text-white sm:px-7 sm:py-[26px]" style={{ background: 'var(--hero-gradient)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dsa-logo.png" alt="" aria-hidden className="pointer-events-none absolute right-6 top-1/2 hidden h-[80%] -translate-y-1/2 opacity-[.12] sm:block" style={{ filter: 'grayscale(1) brightness(2.4)' }} />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-[560px]">
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-[#DDBB38]">This semester{term ? ` · ${term}` : ''}</p>
          <p className="mt-1 text-[22px] font-extrabold sm:text-[28px] leading-tight">{state.title}</p>
          <p className="mt-1.5 text-[13.5px] text-white/80">{state.text}</p>
        </div>
        {state.cta && (state.cta.href ? (
          <Link href={state.cta.href} className="flex h-11 flex-none items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 text-[13.5px] font-semibold text-white hover:bg-white/[.18]">
            {state.cta.label} <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <button onClick={state.cta.onClick} className="flex h-11 flex-none items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 text-[13.5px] font-semibold text-white hover:bg-white/[.18]">
            {state.cta.label} <ArrowRight className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>
      {hasPlacement && (
        <div className="relative sm:overflow-x-auto">
          {/* Phones: the steps run down the card; wider screens: across. */}
          <div className="grid max-w-[900px] grid-cols-1 gap-3 sm:min-w-[560px] sm:grid-cols-5 sm:gap-0">
            {steps.map((s, i) => {
              const now = i === current
              return (
                <div key={s.key} className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <div className="flex items-center sm:w-full">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border-2"
                      style={s.done ? { background: '#2FA57C', borderColor: '#2FA57C', color: '#fff' }
                        : now ? { background: '#DDBB38', borderColor: '#DDBB38', color: '#2B2200' }
                        : { borderColor: 'rgba(255,255,255,.3)', color: 'rgba(255,255,255,.5)' }}>
                      {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <s.Icon className="h-4 w-4" />}
                    </span>
                    {i < steps.length - 1 && <span className="mx-1.5 hidden h-0.5 flex-1 sm:block" style={{ background: s.done ? '#2FA57C' : 'rgba(255,255,255,.2)' }} />}
                  </div>
                  <div className="pr-2.5">
                    <p className={`text-[13px] font-bold ${s.done || now ? 'text-white' : 'text-white/60'}`}>{s.label}</p>
                    <p className="mt-px text-[11.5px] text-white/65">{s.note}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Promissory note ─────────────────────────────────────────────────────────

function PromissoryCard() {
  const qc = useQueryClient()
  const { notify } = useFeedback()
  const [doc, setDoc] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [how, setHow] = useState(false)
  const { data } = useQuery({ queryKey: ['promissory-mine'], queryFn: () => promissoryApi.getMine() })
  const notes = data?.notes ?? []
  const submission = data?.submission

  const submit = useMutation({
    mutationFn: () => promissoryApi.submit(submission!.assignment_id!, doc!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promissory-mine'] })
      qc.invalidateQueries({ queryKey: ['recipient-progress'] })
      setDoc(null); setError(null)
      notify({ title: 'Promissory note submitted', detail: 'It was sent to your supervisor for review. You’ll be notified of the decision.' })
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) =>
      setError(Object.values(e.response?.data?.errors ?? {}).flat()[0] ?? e.response?.data?.message ?? 'Could not submit.'),
  })

  const open = !!submission?.can_submit
  const chip = open ? { label: 'Open', Icon: FileSignature, cls: 'bg-gold-100 text-gold-700' } : { label: 'Closed', Icon: Lock, cls: 'bg-surface-3 text-ink-600' }

  return (
    <div id="promissory" className={`${CARD} scroll-mt-24 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3.5 px-[22px] py-[18px]">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gold-100 text-gold-700"><FileSignature className="h-[22px] w-[22px]" /></span>
        <div className="min-w-[220px] flex-1">
          <p className="text-[15px] font-bold text-ink-950">Short on hours? File a promissory note</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Promise to finish your missing hours so your stipend can still be released.</p>
        </div>
        <span className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${chip.cls}`}><chip.Icon className="h-[15px] w-[15px]" />{chip.label}</span>
      </div>

      {open ? (
        <div className="mx-[22px] mb-[18px] space-y-3 rounded-xl bg-surface-2 p-4">
          <p className="text-[12.5px] text-ink-600">
            You&apos;re short <strong className="text-ink-950">{submission?.lacking_hours} hours</strong>. If you renew, they&apos;re added to your next
            semester&apos;s required hours.{submission?.window_note ? ` ${submission.window_note}` : ''}
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-surface px-3 py-2.5 text-sm text-ink-600 hover:border-accent">
            <Upload className="h-4 w-4" />
            <span className="min-w-0 truncate">{doc ? doc.name : 'Attach your signed note (PDF, Word, JPG or PNG, max 5 MB)'}</span>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                // Same limit and wording as the API (SubmitPromissoryRequest).
                if (file && file.size > 5 * 1024 * 1024) { setDoc(null); setError('The file must be 5 MB or smaller.'); return }
                setError(null); setDoc(file)
              }} />
          </label>
          {error && <p className="text-sm text-danger-700">{error}</p>}
          <button onClick={() => { setError(null); submit.mutate() }} disabled={submit.isPending || !doc}
            className="h-10 rounded-xl bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-50">
            {submit.isPending ? 'Submitting…' : 'Submit promissory note'}
          </button>
        </div>
      ) : submission?.reason ? (
        <p className="mx-[22px] mb-[18px] flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-600">
          <Info className="h-[18px] w-[18px] flex-none text-ink-500" /> {submission.reason}
        </p>
      ) : null}

      {notes.length > 0 && (
        <div className="mx-[22px] mb-[18px] space-y-2">
          {notes.map((n) => {
            const meta = PROMISSORY[n.status]
            return (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/[.06] px-3.5 py-2.5">
                <div className="min-w-0">
                  <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                  <p className="mt-1 text-xs text-ink-500">
                    Short {n.lacking_hours ?? '—'}h{n.status === 'approved' ? ' · added to your next semester if you renew' : ''}{n.created_at ? ` · filed ${formatDate(n.created_at)}` : ''}
                  </p>
                  {n.review_remarks && <p className="text-xs italic text-ink-500">“{n.review_remarks}”</p>}
                </div>
                <button onClick={() => promissoryApi.downloadFile(n.id, n.file_name)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 text-xs font-semibold text-accent-strong hover:border-accent">
                  <FileText className="h-3.5 w-3.5" /> Document
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => setHow((h) => !h)} aria-expanded={how}
        className="flex w-full items-center gap-2 border-t border-ink-900/[.05] bg-surface-2 px-[22px] py-3 text-[12.5px] font-semibold text-accent-strong">
        How it works {how ? <ChevronUp className="h-[18px] w-[18px]" /> : <ChevronDown className="h-[18px] w-[18px]" />}
      </button>
      {how && (
        <div className="grid gap-3 bg-surface-2 px-[22px] pb-5 pt-1 sm:grid-cols-3">
          {[
            ['Upload a signed note', 'Say why you fell short and when you will finish the hours. Notes open after the term ends and close with renewal.'],
            ['Supervisor approves', 'Your supervisor checks it and records the missing hours.'],
            ['Stipend released', 'The DSA can then release your stipend as usual. If you renew, the missing hours are added to your next term.'],
          ].map(([t, d], i) => (
            <div key={t} className="flex gap-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-extrabold text-white">{i + 1}</span>
              <div>
                <p className="text-[13px] font-bold text-ink-950">{t}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{d}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
