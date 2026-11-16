'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Plus, BadgeCheck, CheckCheck, LogIn, LogOut, Eraser, CalendarX, FileSignature, ThumbsUp, ThumbsDown, Gavel,
  RotateCcw, FileText, ClipboardCheck, Ticket, Banknote, RefreshCw, Shuffle, Undo2, UserMinus, Check, ArrowRight, Loader2,
  History, CircleDot,
} from 'lucide-react'
import { testingApi } from '@/lib/api/testing.api'
import { auditApi } from '@/lib/api/analytics.api'
import { formatDay } from '@/lib/utils/semester'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { ApiRequestError } from '@/lib/api/axios'
import type { TestingAccount, TestingAction, TestingStatus } from '@/types/testing.types'
import { CARD, Pill, Shortcut, StepCard, cap, currentTerm, initials, stepsOf, termEnded, termLabel } from './ui'

type WithStatus = { data: TestingStatus; message: string }

const ROLE = {
  recipient: { label: 'Recipient', fg: 'var(--text-accent-strong)', bg: 'var(--color-accent-soft)' },
  applicant: { label: 'Applicant', fg: 'var(--text-violet-600)', bg: 'var(--color-violet-100)' },
}
const TASK_MIN = 10 // same minimum as the student's own Task Description
const SMALL = 'h-9 rounded-[9px] border border-ink-200 bg-surface px-2.5 text-[13px] focus:border-accent focus:outline-none'

/**
 * The selected account in System Testing: who it is and where its term stands (Hours → Term
 * ends → Report → Stipend → Renewal), the shortcuts in that order, everything that happened to
 * it since it was added (from the audit log), and its controls — email switch, role switch,
 * Undo all changes (restore) and Stop testing, keep changes (remove).
 */

/** System Testing: the steps an application can be put at directly. */
const APP_STEPS: [string, string][] = [['submitted', 'Submitted'], ['under_review', 'Under review'], ['interview_scheduled', 'Interview'], ['approved', 'Approved'], ['rejected', 'Rejected']]
export function AccountPanel({ account: a, onStatus, onShortcutDone }: {
  account: TestingAccount
  /** Calls that return the refreshed status (email, role, restore, remove). */
  onStatus: (res: WithStatus) => void
  /** A shortcut ran: refresh the status. */
  onShortcutDone: () => void
}) {
  const qc = useQueryClient()
  const { notify, notifyError, confirm } = useFeedback()
  const t = currentTerm(a)
  const isRecipient = a.role === 'recipient'
  const picked = new Date(a.picked_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const refreshLog = () => qc.invalidateQueries({ queryKey: ['testing-activity', a.id] })

  // ── Shortcuts ──
  const act = useMutation({
    mutationFn: (v: { action: TestingAction; data?: Record<string, unknown> }) => testingApi.act(a.id, v.action, v.data),
    onSuccess: (res) => { notify({ title: res.message, detail: null }); onShortcutDone(); refreshLog() },
    onError: (e: ApiRequestError) => notifyError(e, 'That shortcut failed'),
  })
  const run = (action: TestingAction, data?: Record<string, unknown>) => act.mutate({ action, data })
  const off = act.isPending

  // ── Account controls ──
  const done = (res: WithStatus) => { onStatus(res); refreshLog(); notify({ title: res.message, detail: null }) }
  const email = useMutation({ mutationFn: (muted: boolean) => testingApi.setAccountEmail(a.id, muted), onSuccess: done, onError: (e: ApiRequestError) => notifyError(e, 'Could not change the email switch') })
  const role = useMutation({ mutationFn: (next: 'applicant' | 'recipient') => testingApi.setAccountRole(a.id, next), onSuccess: done, onError: (e: ApiRequestError) => notifyError(e, 'Could not change the role') })
  const restore = useMutation({ mutationFn: () => testingApi.restoreExisting(a.id), onSuccess: done, onError: (e: ApiRequestError) => notifyError(e, 'Could not restore this account') })
  const remove = useMutation({ mutationFn: () => testingApi.removeExisting(a.id), onSuccess: (res) => { onStatus(res); notify({ title: res.message, detail: null }) }, onError: (e: ApiRequestError) => notifyError(e, 'Could not remove this account from testing') })
  const appStep = useMutation({ mutationFn: (v: { id: number; status: string }) => testingApi.setApplicationStatus(v.id, v.status), onSuccess: done, onError: (e: ApiRequestError) => notifyError(e, 'Could not change the application') })
  const startOver = useMutation({ mutationFn: () => testingApi.resetApplications(a.id), onSuccess: done, onError: (e: ApiRequestError) => notifyError(e, 'Could not start over') })
  const busy = email.isPending || role.isPending || restore.isPending || remove.isPending || appStep.isPending || startOver.isPending

  const ask = async (opts: Parameters<typeof confirm>[0], then: () => void) => { if (await confirm(opts)) then() }

  // ── Inputs ──
  const [hours, setHours] = useState('5')
  const [as, setAs] = useState<'verified' | 'pending_verification'>('verified')
  const [date, setDate] = useState('')
  const [eligible, setEligible] = useState(true)
  // Clock out: the Task Description box opens first (unless the student already wrote it).
  const [writing, setWriting] = useState(false)
  const [task, setTask] = useState('')
  const clockOut = (data?: Record<string, unknown>) =>
    act.mutate({ action: 'clock-out', data }, { onSuccess: () => { setWriting(false); setTask('') } })
  const taskBox = writing && !!a.clocked_in_since && !a.clocked_in_task

  const steps = isRecipient ? stepsOf(a) : []
  const nextOpen = steps.findIndex((s) => !s.done)
  const renewal = a.applications.find((x) => x.type === 'renewal')
  const verified = t?.verified_hours ?? 0
  const pending = t?.pending_hours ?? 0
  const required = t?.required_hours ?? 0
  const pct = (h: number) => (required > 0 ? Math.min(100, (h / required) * 100) : 0)

  // Their applications, each with the step buttons (applicants, and recipients not placed yet).
  const hasApproved = a.applications.some((app) => app.status === 'approved' && app.type !== 'renewal')
  const applicationsCard = (
        <div className={`${CARD} px-5 py-[18px]`}>
          <p className="text-[14.5px] font-bold">Applications</p>
          {a.applications.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-500">No application yet. They can apply from the applicant portal while applications are open.</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {a.applications.map((app) => (
                <li key={app.id} className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>#{app.id}</b> · {app.term} · {app.type === 'renewal' ? 'Renewal' : 'New'}</span>
                    <Pill fg="var(--color-info-700)" bg="var(--color-info-100)">{cap(app.status)}</Pill>
                  </div>
                  {/* Jump to any step (no emails; Approved makes a new applicant a recipient). */}
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Set application #${app.id} step`}>
                    {APP_STEPS.map(([value, label]) => (
                      <button key={value} onClick={() => appStep.mutate({ id: app.id, status: value })}
                        disabled={busy || app.status === value}
                        className={`h-7 rounded-lg border px-2.5 text-[11.5px] font-semibold disabled:cursor-default ${app.status === value ? 'border-accent bg-accent-tint text-accent-strong' : 'border-ink-200 bg-surface text-ink-700 hover:bg-ink-50 disabled:opacity-45'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => ask({
              title: `Start ${a.name}'s application over?`,
              body: 'Every application of this account is deleted with its uploaded documents and interview, so they can apply again from the start. Their profile photo stays. Undo all changes brings the applications back, but not the deleted files.',
              confirmLabel: 'Start over',
              tone: 'danger',
            }, () => startOver.mutate())}
              disabled={busy || a.applications.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-[10px] border border-danger-200 bg-surface px-3 text-[12.5px] font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-45">
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
            <p className="text-xs text-ink-500">While testing is on, their interview can be set at any time.</p>
            <Link href="/admin/applications" className="flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
              Review in Applications <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Header + tracker */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3.5 px-[22px] py-[18px]">
          <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full bg-accent-deep text-base font-bold text-white">{initials(a.name)}</span>
          <div className="min-w-[200px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[19px] font-extrabold">{a.name}</span>
              <span className="rounded-md px-2 py-[3px] text-[11.5px] font-bold" style={{ color: ROLE[a.role].fg, background: ROLE[a.role].bg }}>{ROLE[a.role].label}</span>
            </div>
            <p className="mt-0.5 break-all text-[12.5px] text-ink-500">
              {a.email}{a.student_id_number ? ` · ID ${a.student_id_number}` : ''}
              {t ? ` · ${t.term}${t.end_date ? `, ends ${formatDay(t.end_date)}` : ''}` : ''}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={!a.email_muted} disabled={busy}
            onClick={() => email.mutate(!a.email_muted)}
            title={a.email_muted ? 'Bell notifications only; verification and password-reset emails still go out.' : 'Emailed like everyone else.'}
            className="flex h-[38px] flex-none items-center gap-2 rounded-[10px] border border-ink-200 bg-surface pl-3 pr-2 text-[12.5px] font-semibold text-ink-700 disabled:opacity-50">
            <Mail className="h-4 w-4" /> Emails {a.email_muted ? 'off' : 'on'}
            <span className={`flex h-[22px] w-9 rounded-full p-0.5 ${a.email_muted ? 'justify-start bg-ink-300' : 'justify-end bg-accent'}`}><span className="h-[18px] w-[18px] rounded-full bg-white" /></span>
          </button>
        </div>
        {isRecipient && t && (
          <div className="overflow-x-auto px-[22px] pb-5">
            <div className="flex min-w-[520px]">
              {steps.map((s, i) => {
                const now = i === nextOpen
                return (
                  <div key={s.key} className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2"
                        style={{ background: s.done ? 'var(--color-accent)' : 'var(--color-surface)', borderColor: s.done || now ? 'var(--color-accent)' : 'var(--color-ink-300)', color: s.done ? '#fff' : 'var(--text-accent)' }}>
                        {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : now ? <CircleDot className="h-4 w-4" /> : null}
                      </span>
                      {i < steps.length - 1 && <span className="mx-1 h-0.5 flex-1" style={{ background: s.done ? 'var(--color-accent)' : 'var(--color-ink-200)' }} />}
                    </div>
                    <div className="pr-2">
                      <p className="text-[12.5px] font-bold" style={{ color: s.done || now ? 'var(--text-ink-950)' : 'var(--text-ink-400)' }}>{s.label}</p>
                      <p className="mt-px text-[11.5px] text-ink-500">{s.note}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {isRecipient ? (
        !t ? (
          <>
            <p className={`${CARD} px-5 py-5 text-center text-[13px] text-ink-500`}>
              No placement yet. Assignments → Needs an office lists students with an <b>approved</b> application
              {hasApproved ? ', so assign this one an office there.' : '. This account has none: set an application to Approved below, and they appear there.'}
            </p>
            {applicationsCard}
          </>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
            <StepCard n={1} title="Service hours" right={<span className="text-[12.5px] text-ink-600"><strong className="text-ink-950">{verified}h</strong> of {required}h</span>}>
              <div>
                <div className="flex h-2 overflow-hidden rounded-md bg-surface-3">
                  <div style={{ width: `${pct(verified)}%`, background: 'var(--color-accent)' }} />
                  <div style={{ width: `${Math.min(100 - pct(verified), pct(pending))}%`, background: 'var(--color-gold-accent)' }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-500">
                  <span>{pending}h waiting for supervisor</span>
                  <span>{a.clocked_in_since ? `Clocked in since ${new Date(a.clocked_in_since).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not clocked in'}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">Hours
                  <input type="number" step={0.25} min={0.25} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className={`${SMALL} w-[70px]`} />
                </label>
                <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">As
                  <select value={as} onChange={(e) => setAs(e.target.value as typeof as)} className={SMALL}>
                    <option value="verified">Verified</option>
                    <option value="pending_verification">Waiting</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">Date <span className="sr-only">(optional)</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={SMALL} title="Optional: the day the hours were served" />
                </label>
                <button onClick={() => run('hours', { hours: Number(hours), status: as, ...(date ? { date } : {}) })} disabled={off || !(Number(hours) > 0)}
                  className="flex h-9 items-center gap-1 rounded-[9px] bg-accent px-3.5 text-[12.5px] font-bold text-white disabled:opacity-45">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
              {taskBox && (
                <div className="animate-panel-in flex flex-col gap-2 rounded-[10px] border border-ink-200 bg-surface-2 p-3">
                  <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">
                    <span className="flex justify-between">Task description <span className="font-normal">{task.trim().length}/{TASK_MIN}+</span></span>
                    <textarea autoFocus rows={3} maxLength={5000} value={task} onChange={(e) => setTask(e.target.value)}
                      placeholder={`What the student did this shift (at least ${TASK_MIN} characters)`}
                      className="resize-y rounded-[9px] border border-ink-200 bg-surface px-2.5 py-2 text-[13px] font-normal text-ink-900 focus:border-accent focus:outline-none" />
                  </label>
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => { setWriting(false); setTask('') }} disabled={off}
                      className="h-8 rounded-[9px] border border-ink-200 bg-surface px-3 text-[12.5px] font-semibold text-ink-700 disabled:opacity-45">Cancel</button>
                    <button type="button" onClick={() => clockOut({ task: task.trim() })} disabled={off || task.trim().length < TASK_MIN}
                      className="flex h-8 items-center gap-1 rounded-[9px] bg-accent px-3 text-[12.5px] font-bold text-white disabled:opacity-45">
                      {off ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock out
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Shortcut icon={BadgeCheck} label="Verify waiting" onClick={() => run('verify-hours')} disabled={off}
                  title="As the supervisor: verify every hour waiting for review (the real verification, with its notifications)." />
                <Shortcut icon={CheckCheck} label="Complete all" onClick={() => run('complete-hours')} disabled={off}
                  title="Log exactly the hours still missing, verified (up to 8 h a day on past days), so the required hours are complete." />
                <Shortcut icon={LogIn} label="Clock in now" onClick={() => run('clock-in')} disabled={off}
                  title="Open a shift now without the QR scan. The student clocks out by scanning their office QR." />
                <Shortcut icon={LogOut} label="Clock out" disabled={off || taskBox}
                  onClick={() => (a.clocked_in_since && !a.clocked_in_task ? setWriting(true) : clockOut())}
                  title={a.clocked_in_task
                    ? `Clock out now without the QR scan, with the student's task: "${a.clocked_in_task}"`
                    : 'Clock out now without the QR scan, like the student does: write the task description first (it prints on the duty slip).'} />
                <Shortcut icon={LogOut} label="Auto clock-out" onClick={() => run('auto-clock-out')} disabled={off}
                  title="Close the open shift the way the hourly safety net does after 12 hours; the log then waits for the supervisor's review." />
                <Shortcut icon={Eraser} label="Reset hours" danger disabled={off}
                  title="Set every hour of this term aside so it starts again at 0. Undo all changes brings them back."
                  onClick={() => ask({ title: 'Reset this term\'s hours?', body: `All ${verified}h of ${t.term} are set aside so the term starts again at 0. Undo all changes brings them back.`, confirmLabel: 'Reset hours', tone: 'danger' }, () => run('reset-hours'))} />
              </div>
            </StepCard>

            <StepCard n={2} title="End of term" right={<TermPill a={a} />}>
              <p className="text-[12.5px] text-ink-600">Promissory note: <strong className="text-ink-950">{t.promissory ? cap(t.promissory) : 'None'}</strong></p>
              <div className="flex flex-wrap gap-1.5">
                <Shortcut icon={CalendarX} label="End term now" onClick={() => run('end-term')} disabled={off}
                  title="The term's last day becomes yesterday: promissory notes and term-end rules apply now." />
                <Shortcut icon={FileSignature} label="File note" onClick={() => run('file-promissory')} disabled={off}
                  title="File a promissory note for the student with a sample PDF (only after the term has ended). Their supervisor then reviews it." />
                <Shortcut icon={ThumbsUp} label="Approve note" onClick={() => run('approve-promissory')} disabled={off}
                  title="As the supervisor: approve the pending note, recording its lacking hours (added to the next term if the student renews)." />
                <Shortcut icon={ThumbsDown} label="Reject note" onClick={() => run('reject-promissory')} disabled={off} title="As the supervisor: reject the pending note." />
                <Shortcut icon={Gavel} label="Close term" onClick={() => run('close-term')} disabled={off} title="Record Qualified or Deficient now (this term only)." />
                <Shortcut icon={RotateCcw} label="Reset term" danger onClick={() => run('reset-term')} disabled={off} title="Back to in progress: clears the verdict and the term-end shortcut." />
              </div>
            </StepCard>

            <StepCard n={3} title="End-of-term report">
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px]">
                <p className="text-[11.5px] text-ink-500">Report</p>
                <p className="mt-0.5 font-bold">{t.report_eligible !== null ? `Accepted · ${t.report_eligible ? 'Eligible' : 'Not eligible'} for renewal` : t.report_submitted ? 'Submitted, waiting for the supervisor' : 'Not submitted'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Shortcut icon={FileText} label="Submit report" onClick={() => run('term-report')} disabled={off} title="Submit the end-of-term report for the student." />
                <select value={eligible ? 'yes' : 'no'} onChange={(e) => setEligible(e.target.value === 'yes')} aria-label="Renewal mark"
                  className="h-8 rounded-[9px] border border-ink-200 bg-surface px-2 text-xs font-semibold">
                  <option value="yes">Eligible</option>
                  <option value="no">Not eligible</option>
                </select>
                <Shortcut icon={ClipboardCheck} label="Accept report" onClick={() => run('review-report', { eligible })} disabled={off}
                  title="As the supervisor: accept the end-of-term report and mark the student eligible or not for renewal." />
              </div>
            </StepCard>

            <StepCard n={4} title="Stipend" right={<Pill fg={t.stipend ? 'var(--color-accent-strong)' : 'var(--color-ink-600)'} bg={t.stipend ? 'var(--color-accent-soft)' : 'var(--color-surface-3)'}>{t.stipend ? 'Released' : 'Not released'}</Pill>}>
              <div className="flex flex-wrap gap-1.5">
                <Shortcut icon={Ticket} label="Release stipend" onClick={() => run('release-stub')} disabled={off}
                  title="As the admin (Admin → Stipend): release this term's stipend, with the real checks (hours or approved note, signature, end-of-term report). A release is final." />
                <Shortcut icon={Banknote} label="Reset stipend" danger disabled={off}
                  title="Remove this term's stipend stub so the student is eligible again under Admin → Stipend. Undo all changes brings it back."
                  onClick={() => ask({ title: 'Reset this stipend?', body: `The ${t.term} stub is removed so the stipend can be released again. Undo all changes brings it back.`, confirmLabel: 'Reset stipend', tone: 'danger' }, () => run('reset-stipend'))} />
              </div>
            </StepCard>

            <StepCard n={5} title="Renewal" right={renewal ? <Pill fg="var(--color-violet-600)" bg="var(--color-violet-100)">{cap(renewal.status)}</Pill> : undefined}>
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px]">
                <p className="text-[11.5px] text-ink-500">Renewal</p>
                <p className="mt-0.5 font-bold">{renewal ? `#${renewal.id} · ${renewal.term} · ${cap(renewal.status)}` : 'Not submitted'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Shortcut icon={RefreshCw} label="Submit renewal" onClick={() => run('renewal')} disabled={off}
                  title="Submit a renewal for the next term with a sample COR, even if renewal is closed." />
                {renewal && (
                  <Link href="/admin/applications?type=renewal" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                    Review in Applications <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </StepCard>
          </div>
        )
      ) : applicationsCard}

      {/* Activity + controls */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-ink-900/[.05] px-5 py-3.5">
          <span className="flex items-center gap-1.5 text-[14px] font-bold"><History className="h-4 w-4 text-accent" /> What you&apos;ve done</span>
          <span className="text-xs text-ink-500">Added {picked}</span>
        </div>
        <Activity account={a} />
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-900/[.05] bg-surface-2 px-5 py-3.5">
          <button onClick={() => ask({
            title: `Make ${a.name} ${isRecipient ? 'an applicant' : 'a recipient'}?`,
            body: `${isRecipient ? 'Only the role changes: applications and placements aren’t touched. ' : ''}They see the ${isRecipient ? 'applicant' : 'recipient'} portal right away. Undo all changes puts the original role back.${isRecipient ? '' : ' Their latest application is also set to Approved (one is created if they have none), so they appear in Assignments → Needs an office.'}`,
            confirmLabel: isRecipient ? 'Make applicant' : 'Make recipient',
          }, () => role.mutate(isRecipient ? 'applicant' : 'recipient'))}
            disabled={busy} title="Change the role only"
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[12.5px] font-semibold text-ink-700 disabled:opacity-45">
            <Shuffle className="h-4 w-4" /> {isRecipient ? 'Make applicant' : 'Make recipient'}
          </button>
          <span className="flex-1" />
          {a.restorable && (
            <button onClick={() => ask({
              title: `Undo all changes to ${a.name}?`,
              body: `Their record goes back to how it was on ${picked}: everything done since — hours, notes, reviews, results, reports, renewals and placements, stubs, the role — is removed or changed back. They stay in System Testing.`,
              confirmLabel: 'Undo all changes', tone: 'danger',
            }, () => restore.mutate())} disabled={busy} title="Put the account back to how it was when added"
              className="flex h-9 items-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface px-3 text-[12.5px] font-semibold text-ink-700 disabled:opacity-45">
              {restore.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Undo all changes
            </button>
          )}
          <button onClick={() => ask(a.restorable
            ? { title: `Stop testing ${a.name}?`, body: 'They leave testing as they are now: test hours, notes, results and other changes stay on the account, and their emails come back on. Use Undo all changes first to undo the test.', confirmLabel: 'Stop testing, keep changes', tone: 'danger' }
            : { title: `Stop testing ${a.name}?`, body: 'Picked before restore points existed: stopping cleans up what was created while it was in testing.', confirmLabel: 'Clean up and stop', tone: 'danger' },
          () => remove.mutate())} disabled={busy} title="Stop testing and keep changes"
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-danger-200 bg-surface px-3 text-[12.5px] font-semibold text-red-strong hover:bg-danger-50 disabled:opacity-45">
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />} Stop testing, keep changes
          </button>
        </div>
      </div>
    </div>
  )
}

function TermPill({ a }: { a: TestingAccount }) {
  const t = currentTerm(a)
  if (!t) return null
  const label = termLabel(t)
  const [fg, bg] = label.startsWith('Qualified') ? ['var(--color-accent-strong)', 'var(--color-accent-soft)'] : label.startsWith('Deficient') ? ['var(--color-red-strong)', 'var(--color-danger-100)']
    : termEnded(t) ? ['var(--color-gold-700)', 'var(--color-gold-100)'] : ['var(--color-info-700)', 'var(--color-info-100)']
  return <Pill fg={fg} bg={bg}>{label}</Pill>
}

/** Everything recorded about the account since it was added (audit log, newest first). */
function Activity({ account: a }: { account: TestingAccount }) {
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(a.picked_at))
  const log = useInfiniteQuery({
    queryKey: ['testing-activity', a.id, a.picked_at],
    queryFn: ({ pageParam }) => auditApi.list({ subject_user_id: String(a.id), from, page: String(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const pickedAt = new Date(a.picked_at).getTime()
  const entries = (log.data?.pages.flatMap((p) => p.data) ?? []).filter((e) => new Date(e.created_at).getTime() >= pickedAt - 1000)

  return (
    <div className="max-h-[220px] overflow-auto">
      {log.isLoading ? (
        <div className="space-y-2 p-4">{[1, 2].map((n) => <div key={n} className="h-6 animate-pulse rounded bg-ink-100" />)}</div>
      ) : entries.length === 0 ? (
        <p className="px-5 py-4 text-[12.5px] text-ink-400">Nothing yet. Use a shortcut above.</p>
      ) : (
        <>
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2.5 border-b border-ink-900/[.04] px-5 py-2 text-[12.5px]">
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span className="min-w-0 flex-1">{e.summary}{e.actor && e.actor.role !== 'admin' ? <span className="text-ink-500"> · by {e.actor.name}</span> : null}</span>
              <span className="flex-none text-ink-400">{new Date(e.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          ))}
          {log.hasNextPage && (
            <button onClick={() => log.fetchNextPage()} disabled={log.isFetchingNextPage} className="w-full py-2 text-xs font-semibold text-accent hover:bg-ink-50">
              {log.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
