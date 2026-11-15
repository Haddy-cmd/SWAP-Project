'use client'

import { useState, type ComponentType, type CSSProperties } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  FileText, Users, Hourglass, Timer, RefreshCw, UserCheck, Flag, CalendarX, ChevronRight, Download, Loader2,
  ClipboardList, Clock, Building2, Wallet, CheckCircle2,
} from 'lucide-react'
import { reportsApi } from '@/lib/api/reports.api'
import { saveBlob } from '@/lib/utils/download'
import { termParams, termSlug } from '@/lib/utils/term'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { useChartType } from '@/components/charts/ChartTypeToggle'
import { CountUp } from '@/components/ui/CountUp'
import { CARD, GOLD, GREEN, READY, RED, Card, Seg, Skeleton, pct, plural, useAnalytics, type TabProps } from './shared'

type Icon = ComponentType<{ className?: string }>
type Tone = 'gold' | 'red' | 'grey'
const TONE: Record<Tone, { bg: string; border: string; fg: string }> = {
  gold: { bg: 'var(--color-gold-50)', border: 'var(--color-gold-200)', fg: 'var(--text-gold-700)' },
  red: { bg: 'var(--color-danger-50)', border: 'var(--color-danger-200)', fg: 'var(--text-red-strong)' },
  grey: { bg: 'var(--color-surface-2)', border: 'var(--color-surface-3)', fg: 'var(--text-ink-600)' },
}

/**
 * Overview: four KPIs, "Worth a look" (what stands out, each opening its tab), where the
 * term's applications stand, and one-click ready-made reports.
 */
export function OverviewTab({ academicYear, semester, allTerms, onDrill, onTab }: TabProps & { onTab: (tab: string) => void }) {
  const { overview, insights, loading, refreshing } = useAnalytics(academicYear, semester)
  const [appView, setAppView] = useChartType('analytics-applications-stand', ['bar', 'pie'] as const, 'bar')

  if (loading && !overview) {
    return <div className="space-y-5"><Skeleton h="h-28" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton h="h-80" /><Skeleton h="h-80" /></div></div>
  }

  const pending = overview?.pending_applications ?? 0
  const kpis: { label: string; value: number; format?: (n: number) => string; hint: string; Icon: Icon; bg: string; fg: string; onClick: () => void }[] = [
    { label: 'Applications', value: overview?.total_applications ?? 0, hint: allTerms ? 'all semesters' : 'this semester', Icon: FileText, bg: 'var(--color-gold-100)', fg: 'var(--text-gold-700)',
      onClick: () => onDrill({ tab: 'applications' }) },
    { label: 'Active recipients', value: overview?.active_recipients ?? 0, hint: `in ${plural(overview?.office_distribution_all?.filter((o) => o.recipient_count > 0).length ?? 0, 'office', 'offices')}`,
      Icon: Users, bg: 'var(--color-accent-soft)', fg: 'var(--text-accent-strong)', onClick: () => onDrill({ tab: 'recipients', filters: { status: ['Active'] } }) },
    { label: 'Waiting for a decision', value: pending, hint: pending ? 'applications not yet decided' : 'all caught up', Icon: Hourglass, bg: 'var(--color-info-100)', fg: 'var(--text-info-700)',
      onClick: () => onDrill({ tab: 'applications', filters: { status: ['Submitted', 'Under Review', 'Interview Scheduled'] } }) },
    { label: 'Avg. completion', value: Number(overview?.avg_completion_rate ?? 0), format: (n) => `${n.toFixed(1)}%`, hint: 'of the required hours', Icon: Timer, bg: 'var(--color-danger-100)', fg: 'var(--text-red-strong)',
      onClick: () => onDrill({ tab: 'recipients', sort: 'verified_hours', dir: 'asc' }) },
  ]

  // ── Worth a look ──
  const items: { Icon: Icon; title: string; detail: string; tone: Tone; tab: string }[] = []
  if (insights) {
    const r = insights.renewals
    const ready = r.waiting_reasons.find((w) => w.reason === READY)?.count ?? 0
    const blocked = r.waiting - ready
    if (ready > 0) {
      items.push({ Icon: RefreshCw, tone: 'gold', tab: 'money', title: `${plural(ready, 'renewal is', 'renewals are')} ready to approve`,
        detail: blocked ? `${r.waiting} are waiting in total. The rest are missing a requirement.` : 'Nothing is holding them back.' })
    }
    const wl = insights.workload.filter((w) => w.pending > 0)
    const waitingLogs = wl.reduce((s, w) => s + w.pending, 0)
    if (waitingLogs > 0) {
      const top = wl.reduce((a, b) => (b.pending > a.pending ? b : a))
      const oldest = Math.max(...wl.map((w) => w.oldest_pending_days ?? 0))
      items.push({ Icon: UserCheck, tone: 'gold', tab: 'supervisors', title: `Supervisors have ${plural(waitingLogs, 'hour log', 'hour logs')} to verify`,
        detail: `${top.name} has the most (${top.pending}).${oldest > 0 ? ` The oldest has waited ${plural(oldest, 'day', 'days')}.` : ''}` })
    }
    const flaggedOffices = insights.integrity.filter((o) => o.flagged > 0)
    const flagged = flaggedOffices.reduce((s, o) => s + o.flagged, 0)
    if (flagged > 0) {
      items.push({ Icon: Flag, tone: 'red', tab: 'hours', title: `${plural(flagged, 'attendance log was', 'attendance logs were')} flagged`,
        detail: `Spread across ${plural(flaggedOffices.length, 'office', 'offices')}. Worth a quick check.` })
    }
    if (insights.funnel.no_shows > 0) {
      items.push({ Icon: CalendarX, tone: 'grey', tab: 'apps', title: `${plural(insights.funnel.no_shows, 'applicant', 'applicants')} missed their interview`,
        detail: 'You may want to reschedule or close these.' })
    }
  }

  // ── Where applications stand (new applications of the term) ──
  const f = insights?.funnel
  const approved = f?.approved ?? 0
  const waiting = f?.waiting ?? 0
  const rejected = f?.rejected ?? 0
  const total = approved + waiting + rejected
  const avg = f?.avg_days_to_decision

  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <button key={k.label} onClick={k.onClick} title={`Open ${k.label.toLowerCase()} in All reports`}
            className={`${CARD} px-5 py-[18px] text-left transition-shadow hover:shadow-[0_8px_22px_rgba(19,36,26,0.10)]`}>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: k.bg, color: k.fg }}><k.Icon className="h-[18px] w-[18px]" /></span>
              {k.label}
            </span>
            <CountUp value={k.value} format={k.format} className="mt-3 block text-[32px] font-extrabold leading-none text-ink-950" />
            <span className="mt-1.5 block text-[12.5px] text-ink-500">{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {!allTerms && <Card title="Worth a look" hint="We picked out what stands out. Click one to see the details.">
          <div className="stagger mt-4 flex flex-col gap-2.5">
            {items.length === 0 ? (
              <p className="flex items-center gap-2.5 rounded-[14px] border border-ink-900/[.06] bg-surface-2 px-4 py-3.5 text-[13.5px] text-ink-600">
                <CheckCircle2 className="h-5 w-5 text-accent" /> Nothing stands out this semester.
              </p>
            ) : items.map((i) => {
              const t = TONE[i.tone]
              return (
                <button key={i.title} onClick={() => onTab(i.tab)}
                  className="flex items-center gap-3.5 rounded-[14px] border px-4 py-3.5 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(19,36,26,0.08)]"
                  style={{ background: t.bg, borderColor: t.border }}>
                  <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-surface" style={{ color: t.fg }}><i.Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink-950">{i.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-600">{i.detail}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 flex-none text-ink-400" />
                </button>
              )
            })}
          </div>
        </Card>}

        <div className="flex flex-col gap-5">
          <Card title="Where applications stand"
            hint={total ? <>{total} new {allTerms ? 'across all semesters' : 'this semester'}{avg != null ? ` · ${avg} days to a decision on average` : ''}</> : allTerms ? 'No new applications yet.' : 'No new applications this semester yet.'}
            right={<Seg label="Applications chart" value={appView} onChange={setAppView} options={[['bar', 'Bar'], ['pie', 'Donut']] as const} />}>
            {total > 0 && (appView === 'bar' ? (
              <div className="animate-content-in mt-[18px] flex h-[30px] gap-[3px] overflow-hidden rounded-[9px]">
                {approved > 0 && <div className="bar-grow-x" style={{ flex: approved, background: GREEN }} title={`Approved: ${approved}`} />}
                {waiting > 0 && <div className="bar-grow-x" style={{ flex: waiting, background: GOLD }} title={`Waiting: ${waiting}`} />}
                {rejected > 0 && <div className="bar-grow-x" style={{ flex: rejected, background: RED }} title={`Not approved: ${rejected}`} />}
              </div>
            ) : (
              <div className="animate-content-in mt-[18px] flex justify-center">
                {/* --a / --b sweep from 0 (globals.css .ring-fill). */}
                <div className="ring-fill relative h-[150px] w-[150px] rounded-full" style={{
                  '--a': pct(approved, total), '--b': pct(approved + waiting, total),
                  background: `conic-gradient(${GREEN} 0 calc(var(--a) * 1%), ${GOLD} calc(var(--a) * 1%) calc(var(--b) * 1%), ${RED} calc(var(--b) * 1%) 100%)`,
                } as CSSProperties}>
                  <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-surface">
                    <CountUp value={pct(approved, total)} format={(n) => `${Math.round(n)}%`} className="text-2xl font-extrabold leading-none" />
                    <span className="mt-1 text-[11.5px] text-ink-500">approved</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {([['Approved', approved, GREEN, ['Approved']], ['Waiting', waiting, GOLD, ['Submitted', 'Under Review', 'Interview Scheduled']], ['Not approved', rejected, RED, ['Rejected']]] as const).map(([label, n, color, statuses]) => (
                <button key={label} onClick={() => onDrill({ tab: 'applications', filters: { status: [...statuses], type: ['New'] } })}
                  className="-mx-1 rounded-lg px-1 py-0.5 text-left hover:bg-ink-50" title={`See the ${label.toLowerCase()} applications`}>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600"><span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: color }} />{label}</span>
                  <CountUp value={n} className="mt-0.5 block text-xl font-extrabold" />
                </button>
              ))}
            </div>
          </Card>

          <Card title="Ready-made reports" hint="One click, no setup">
            <ReadyReports academicYear={academicYear} semester={semester} allTerms={allTerms} recipients={overview?.active_recipients ?? 0} />
          </Card>
        </div>
      </div>
    </div>
  )
}

/** One-click downloads of the term's usual files (the same exports as All reports). */
function ReadyReports({ academicYear, semester, allTerms, recipients }: { academicYear: string; semester: string; allTerms: boolean; recipients: number }) {
  const { notify, notifyError } = useFeedback()
  const term = { ...termParams(academicYear, semester), filters: {} }
  const slug = termSlug(academicYear, semester)
  const reports: { key: string; Icon: Icon; name: string; desc: string; fmt: 'PDF' | 'CSV'; file: string; run: () => Promise<{ blob: Blob; filename: string | null }> }[] = [
    { key: 'summary', Icon: ClipboardList, name: allTerms ? 'Program summary' : 'Semester summary', desc: 'The numbers on these tabs, for meetings', fmt: 'PDF', file: `program-overview-${slug}.pdf`,
      run: () => reportsApi.overviewPdf(academicYear, semester) },
    { key: 'hours', Icon: Clock, name: 'Hours per recipient', desc: recipients ? `Verified and remaining hours for all ${recipients} recipients` : 'Verified and remaining hours per recipient', fmt: 'CSV', file: `recipients-${slug}.csv`,
      run: () => reportsApi.export('admin', 'recipients', term, 'csv') },
    { key: 'rosters', Icon: Building2, name: 'Office rosters', desc: 'Who is assigned where, with supervisors', fmt: 'CSV', file: `office-rosters-${slug}.csv`,
      run: () => reportsApi.export('admin', 'recipients', { ...term, sort: 'office', dir: 'asc' }, 'csv') },
    { key: 'stipend', Icon: Wallet, name: 'Stipend release list', desc: allTerms ? 'Every stipend and its status' : 'Stipends of the term and their status', fmt: 'PDF', file: `stipend-${slug}.pdf`,
      run: () => reportsApi.export('admin', 'stipend', term, 'pdf') },
  ]
  const [busy, setBusy] = useState<string | null>(null)
  const dl = useMutation({
    mutationFn: (r: (typeof reports)[number]) => r.run().then((out) => ({ ...out, r })),
    onMutate: (r) => setBusy(r.key),
    onSettled: () => setBusy(null),
    onSuccess: ({ blob, filename, r }) => {
      const name = filename ?? r.file
      saveBlob(blob, name)
      notify({ title: `${r.name} downloaded`, detail: `${name} — check your downloads folder.` })
    },
    onError: (e) => notifyError(e, 'Could not generate the file'),
  })

  return (
    <div className="mt-2.5 flex flex-col">
      {reports.map((r) => (
        <div key={r.key} className="flex items-center gap-3 border-b border-ink-900/[.05] py-[11px] last:border-0">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-surface-3 text-ink-700"><r.Icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink-950">{r.name}</p>
            <p className="text-xs text-ink-500">{r.desc}</p>
          </div>
          <button onClick={() => dl.mutate(r)} disabled={dl.isPending}
            className="flex h-[34px] flex-none items-center gap-1.5 rounded-[9px] border border-ink-200 bg-surface px-3 text-[12.5px] font-semibold text-accent-strong hover:border-accent disabled:opacity-50">
            {busy === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {r.fmt}
          </button>
        </div>
      ))}
    </div>
  )
}
