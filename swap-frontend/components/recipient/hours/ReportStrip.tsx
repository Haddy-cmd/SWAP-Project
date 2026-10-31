'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, CheckCircle2, Hourglass, BadgeCheck, Circle, ChevronDown, ChevronUp, PenLine } from 'lucide-react'
import { TermReportCard } from '@/components/attendance/TermReportCard'
import type { TermReport, TermReportMeta } from '@/types/attendance.types'
import { CARD } from './ui'

type StepState = 'done' | 'now' | 'todo'

/**
 * The end-of-term report as a strip: Submitted → Supervisor review → Accepted, with the form
 * or the submitted report one click away (the same TermReportCard rules: 50 characters or a PDF/Word file,
 * editable until accepted or the stipend is released). `#report` opens it.
 */
export function ReportStrip({ report, meta, due }: { report: TermReport | null; meta: TermReportMeta; due: boolean }) {
  const [open, setOpen] = useState(false)

  // Links to #report (dashboard banner, reminder emails) open the strip and scroll to it.
  useEffect(() => {
    const openIfAsked = () => { if (window.location.hash === '#report') { setOpen(true); document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }
    openIfAsked()
    window.addEventListener('hashchange', openIfAsked)
    return () => window.removeEventListener('hashchange', openIfAsked)
  }, [])

  const submitted = !!report?.submitted_at
  const accepted = !!report?.reviewed_at
  const steps: { label: string; Icon: typeof Circle; state: StepState }[] = [
    { label: 'Submitted', Icon: CheckCircle2, state: submitted ? 'done' : 'now' },
    { label: 'Supervisor review', Icon: Hourglass, state: accepted ? 'done' : submitted ? 'now' : 'todo' },
    { label: accepted ? (report?.renewal_eligible ? 'Accepted · eligible' : 'Accepted · not eligible') : 'Accepted', Icon: BadgeCheck, state: accepted ? 'done' : 'todo' },
  ]
  const tone: Record<StepState, string> = {
    done: 'bg-accent-soft text-accent-strong',
    now: 'bg-gold-100 text-gold-700',
    todo: 'bg-surface-3 text-ink-400',
  }
  // Not open yet: semester not over, or hours short with no promissory note (the server's reason).
  // No prompt until then (the dashboard checklist says when it opens).
  if (!report && meta.editable && !meta.can_submit) return null
  const subtitle = accepted ? 'Accepted by your supervisor.'
    : submitted ? 'Submitted. Your supervisor reviews it next.'
    : 'Due now. Your stipend can’t be released without it.'
  const canWrite = !report && meta.editable && meta.can_submit

  return (
    <div id="report" className={`${CARD} scroll-mt-24 overflow-hidden ${due && !submitted ? 'border-gold-accent' : ''}`}>
      <div className="flex flex-wrap items-center gap-3.5 px-[22px] py-[18px]">
        <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-info-100 text-info-700"><ClipboardList className="h-[21px] w-[21px]" /></span>
        <div className="min-w-[220px] flex-1">
          <p className="text-[15px] font-bold text-ink-950">End-of-term report</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-[5px] text-xs font-bold ${tone[s.state]}`}><s.Icon className="h-[15px] w-[15px]" />{s.label}</span>
              {i < steps.length - 1 && <span className="h-0.5 w-3.5 bg-ink-200" />}
            </span>
          ))}
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={`flex h-9 items-center gap-1 rounded-[10px] border px-3 text-[12.5px] font-semibold ${canWrite && !open ? 'border-accent bg-accent text-white' : 'border-ink-200 bg-surface text-ink-700'}`}>
          {canWrite && !open ? <><PenLine className="h-4 w-4" /> Write it</> : <>{open ? 'Hide' : 'View'} {open ? <ChevronUp className="h-[18px] w-[18px]" /> : <ChevronDown className="h-[18px] w-[18px]" />}</>}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-900/[.05] px-[22px] pb-5 pt-1">
          <TermReportCard bare />
        </div>
      )}
    </div>
  )
}
