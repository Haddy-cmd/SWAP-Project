'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, ClipboardCheck, ClipboardList, FileText, FolderOpen, ListChecks, Loader2, PlusCircle, SlidersHorizontal, Target, UserRound, X,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { blocksBulkVerify } from '@/lib/utils/attendanceReview'
import { paceDetail } from '@/lib/utils/pace'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { ApiRequestError } from '@/lib/api/axios'
import { barColor, behind, firstName, hrs, pctOf, qualified, type Row } from './rows'

const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const TOOL = 'flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface text-[12.5px] font-semibold text-ink-700 transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-200'
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

/** The selected student: hours and pace, what needs doing, and the supervisor's tools. */
export function StudentPanel({ row, onClose, onReport, onRequired, onDocs }: {
  row: Row
  onClose: () => void
  onReport: () => void
  onRequired: () => void
  onDocs: () => void
}) {
  const qc = useQueryClient()
  const { notify, notifyError } = useFeedback()
  const [bonusOpen, setBonusOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState('')
  const [bonusError, setBonusError] = useState<string | null>(null)
  const [reminded, setReminded] = useState(false)

  // A different student: close the bonus form and start fresh.
  useEffect(() => { setBonusOpen(false); setAmount(''); setReason(''); setDate(today()); setBonusError(null); setReminded(false) }, [row.userId])

  const refresh = () => {
    for (const key of ['supervisor-students', 'supervisor-pending-logs', 'verifications', 'student-logs', 'student-summary']) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }

  // This student's waiting logs, to verify the clean ones in one go (same rule as Verify all).
  const { data: pending = [] } = useQuery({
    queryKey: ['supervisor-pending-logs'],
    queryFn: () => attendanceApi.getPendingVerifications(),
    enabled: row.pendingLogs > 0,
  })
  const mine = pending.filter((l) => l.user_id === row.userId)
  const clean = mine.filter((l) => !blocksBulkVerify(l))
  const flagged = mine.length - clean.length
  const cleanHours = clean.reduce((a, l) => a + (Number(l.duration_hours) || 0), 0)

  const verifyClean = useMutation({
    mutationFn: () => attendanceApi.verifyLogsBulk(clean.map((l) => l.id)),
    onSuccess: (r) => {
      notify({
        title: `${r.meta?.verified ?? clean.length} ${clean.length === 1 ? 'log' : 'logs'} verified · ${hrs(cleanHours)}`,
        detail: flagged ? `${flagged} ${flagged === 1 ? 'needs' : 'need'} a closer look in the time logs.` : null,
      })
      refresh()
    },
    onError: (e) => notifyError(e, 'Could not verify the logs'),
  })

  const n = Number(amount)
  const bonusOk = n >= 0.25 && n <= 24 && !!reason.trim() && !!date
  const addBonus = useMutation({
    mutationFn: () => attendanceApi.addManualHours(row.userId, { hours: n, date, reason: reason.trim() }),
    onSuccess: () => {
      notify({ title: `${n} bonus ${n === 1 ? 'hour' : 'hours'} added for ${firstName(row.name)}`, detail: 'Counted as verified hours.' })
      setBonusOpen(false); setAmount(''); setReason(''); setDate(today())
      refresh()
    },
    onError: (e: ApiRequestError) => setBonusError(Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? 'Could not add the hours.'),
  })

  const remind = useMutation({
    mutationFn: () => attendanceApi.remindPace(row.userId),
    onSuccess: () => { setReminded(true); notify({ title: `Reminder sent to ${firstName(row.name)}`, detail: 'They get a notification and an email.' }); refresh() },
    onError: (e) => notifyError(e, 'Could not send the reminder'),
  })
  const remindBlocked = reminded || row.remindedToday ? 'Reminded today' : !behind(row) ? 'Only for students behind pace' : null

  const pct = pctOf(row)
  const pace = qualified(row) ? 'Qualified' : behind(row) ? `Behind · ${paceDetail(row.pace)}` : 'On track'
  const paceTone = qualified(row) ? 'text-accent-strong' : behind(row) ? 'text-warning-700' : 'text-info-700'

  const tasks = [
    ...(row.pendingLogs > 0 ? [{
      key: 'logs', Icon: ClipboardList, tone: 'border-gold-200 bg-gold-50 text-warning-700',
      label: `${row.pendingLogs} ${row.pendingLogs === 1 ? 'log' : 'logs'} to verify`,
      note: flagged ? `${flagged} ${flagged === 1 ? 'needs' : 'need'} a closer look` : null,
      cta: clean.length ? (verifyClean.isPending ? 'Verifying…' : 'Verify') : 'Time logs',
      onClick: clean.length ? () => verifyClean.mutate() : undefined,
      href: clean.length ? undefined : `/supervisor/students/${row.userId}/logs`,
    }] : []),
    ...(row.reportToReview ? [{
      key: 'report', Icon: FileText, tone: 'border-info-100 bg-info-50 text-info-700',
      label: 'End-of-term report', note: null, cta: 'Review', onClick: onReport, href: undefined,
    }] : []),
    ...(row.pendingRequired != null ? [{
      key: 'required', Icon: Target, tone: 'border-gold-200 bg-gold-50 text-warning-700',
      label: `Required hours change to ${row.pendingRequired}h requested`, note: null, cta: 'Review',
      onClick: undefined, href: `/supervisor/students/${row.userId}/logs`,
    }] : []),
  ]

  return (
    <aside className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-3 px-[18px] py-4" style={{ background: 'var(--hero-gradient-plain)' }}>
        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} className="h-11 w-11 rounded-full bg-white" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-extrabold text-white">{row.name}</div>
          <div className="truncate text-[12px] text-white/75">{row.email}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-white/10 text-white hover:bg-white/20">
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[24px] font-extrabold text-ink-950">
              {hrs(row.verified)} <span className="text-[13px] font-medium text-ink-500">of {hrs(row.required)}</span>
              {row.bonus > 0 && (
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 align-middle text-[11.5px] font-bold text-violet-600">+{hrs(row.bonus)} bonus</span>
              )}
            </span>
            <span className={`text-[12.5px] font-bold ${paceTone}`}>{pace}</span>
          </div>
          <div className="mt-2 h-2 rounded-md bg-ink-100">
            <div className={`bar-grow-x h-full rounded-md ${barColor(row)}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11.5px] text-ink-500">{row.office}{row.studentNo ? ` · ${row.studentNo}` : ''}</div>
        </div>

        {tasks.map((t) => (
          <div key={t.key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${t.tone}`}>
            <t.Icon className="h-5 w-5 flex-none" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink-900">{t.label}</span>
              {t.note && (
                <Link href={`/supervisor/students/${row.userId}/logs`} className="text-[11.5px] font-semibold underline-offset-2 hover:underline">
                  {t.note} → Time logs
                </Link>
              )}
            </span>
            {t.href ? (
              <Link href={t.href} className="flex h-8 flex-none items-center rounded-[9px] bg-accent px-3 text-[12px] font-bold text-white hover:bg-accent-hover">{t.cta}</Link>
            ) : (
              <button type="button" onClick={t.onClick} disabled={t.key === 'logs' && verifyClean.isPending}
                className="flex h-8 flex-none items-center gap-1 rounded-[9px] bg-accent px-3 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-60">
                {t.key === 'logs' && verifyClean.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t.cta}
              </button>
            )}
          </div>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={TOOL} onClick={() => { setBonusError(null); setBonusOpen((o) => !o) }} aria-expanded={bonusOpen}>
            <PlusCircle className="h-4 w-4" /> Bonus hours
          </button>
          <button type="button" className={TOOL} onClick={onRequired}><SlidersHorizontal className="h-4 w-4" /> Required hours</button>
          <Link href={`/supervisor/students/${row.userId}/logs`} className={TOOL}><ListChecks className="h-4 w-4" /> Time logs</Link>
          <Link href={`/supervisor/students/${row.userId}/duty-slip`} className={TOOL}><FileText className="h-4 w-4" /> Duty slip</Link>
          <button type="button" className={TOOL} onClick={() => remind.mutate()} disabled={!!remindBlocked || remind.isPending}
            title={remindBlocked ?? 'Remind them they are behind'}>
            {remind.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} {remindBlocked === 'Reminded today' ? 'Reminded' : 'Remind'}
          </button>
          <button type="button" className={TOOL} onClick={onDocs}><FolderOpen className="h-4 w-4" /> Documents</button>
          <Link href={`/supervisor/students/${row.userId}`} className={`${TOOL} col-span-2`}><UserRound className="h-4 w-4" /> Full profile</Link>
        </div>
        {remindBlocked && <p className="-mt-2 text-[11.5px] text-ink-400">Remind: {remindBlocked.toLowerCase()}.</p>}

        {bonusOpen && (
          <form className="flex flex-col gap-2.5 rounded-[14px] border border-accent/25 bg-accent-tint p-3.5"
            onSubmit={(e) => { e.preventDefault(); if (bonusOk) { setBonusError(null); addBonus.mutate() } }}>
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-ink-950">Add bonus hours</span>
              <button type="button" onClick={() => setBonusOpen(false)} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 items-center gap-1 rounded-[9px] border border-ink-200 bg-surface px-2.5">
                <span className="sr-only">Hours</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus
                  className="w-12 border-none bg-transparent text-right text-[13px] font-bold text-ink-900 focus:outline-none" />
                <span className="text-[12px] text-ink-500">h</span>
              </label>
              <label className="flex h-9 flex-1 items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-2.5">
                <span className="text-[12px] text-ink-500">On</span>
                <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
                  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-900 focus:outline-none" />
              </label>
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255}
              placeholder="Reason, e.g. helped during enrollment week"
              className="h-[38px] rounded-[10px] border border-ink-200 bg-surface px-3 text-[13px] text-ink-900 placeholder-ink-400 focus:border-accent focus:outline-none" />
            {bonusError && <p className="text-[12px] text-danger-700">{bonusError}</p>}
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-[12px] text-ink-600">
                {row.bonus > 0 ? `Already given: ${hrs(row.bonus)} bonus` : 'Recorded separately as bonus, counted as verified'}
              </span>
              <button type="submit" disabled={!bonusOk || addBonus.isPending}
                className="h-9 rounded-[10px] bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-50">
                {addBonus.isPending ? 'Adding…' : n > 0 ? `Add ${hrs(n)}` : 'Add'}
              </button>
            </div>
            {amount && (n < 0.25 || n > 24) && <p className="-mt-1 text-[11.5px] text-danger-700">Between 0.25 and 24 hours.</p>}
          </form>
        )}
      </div>
    </aside>
  )
}

export function EmptyPanel() {
  return (
    <aside className={`${CARD} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
      <ClipboardCheck className="h-8 w-8 text-ink-350" />
      <p className="text-[13px] text-ink-500">Pick a student to see their hours and what they need.</p>
    </aside>
  )
}
