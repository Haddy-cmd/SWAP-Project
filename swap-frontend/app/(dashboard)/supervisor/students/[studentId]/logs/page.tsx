'use client'

import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft, PlusCircle, Target, CheckCircle, XCircle, Clock, FileText,
  ChevronDown, Sparkles, MapPinOff, Info, CheckCircle2, Ban, Hourglass, CalendarX, Loader2, X, ZoomIn,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ManualHoursModal, RequiredHoursModal } from '@/components/attendance/HoursModals'
import type { TimeLog } from '@/types/attendance.types'

type Tab = 'all' | 'verified' | 'pending' | 'rejected'

const STATUS = {
  verified: { key: 'verified', label: 'Verified', color: '#2C5A33', bg: '#EAF5EC', accent: '#4E9657', Icon: CheckCircle2, Group: CheckCircle2 },
  pending_verification: { key: 'pending', label: 'Pending', color: '#9A6B12', bg: '#FBF3E2', accent: '#D8A12B', Icon: Clock, Group: Hourglass },
  rejected: { key: 'rejected', label: 'Rejected', color: '#B0562F', bg: '#FDF0E9', accent: '#C0562F', Icon: XCircle, Group: CalendarX },
  open: { key: 'open', label: 'In progress', color: '#1F5C86', bg: '#EAF1F7', accent: '#3B7FB5', Icon: Clock, Group: Clock },
} as const

const metaOf = (l: TimeLog) => STATUS[(l.status as keyof typeof STATUS)] ?? STATUS.pending_verification
const fmtHrs = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))
const fmtDur = (h: number) => {
  const total = Math.round((Number(h) || 0) * 60)
  const hh = Math.floor(total / 60), mm = total % 60
  return mm ? `${hh}h ${mm}m` : `${hh}h`
}
const fmtTime = (iso?: string | null) => (iso ? format(new Date(iso), 'h:mm a') : '')
const timeRange = (l: TimeLog) => {
  if (l.is_manual) return 'Bonus credit'
  const a = fmtTime(l.time_in), b = fmtTime(l.time_out)
  return b ? `${a} – ${b}` : a || '—'
}
const narrativeOf = (l: TimeLog) => l.narrative_report?.content || l.narrative_report?.activities_done || ''

export default function StudentLogsPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [expanded, setExpanded] = useState<Record<number, true>>({})
  const [modal, setModal] = useState<'bonus' | 'required' | null>(null)
  const [rejecting, setRejecting] = useState<{ id: number; reason: string } | null>(null)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)

  const { data: summaryData } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: () => attendanceApi.getStudentSummary(Number(studentId)),
    enabled: !!studentId,
  })
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['student-logs', studentId],
    queryFn: () => attendanceApi.getStudentLogs(Number(studentId), { per_page: '200' }),
    enabled: !!studentId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-logs', studentId] })
    qc.invalidateQueries({ queryKey: ['student-summary', studentId] })
    qc.invalidateQueries({ queryKey: ['supervisor-students'] })
  }

  const verify = useMutation({
    mutationFn: (p: { id: number; action: 'verified' | 'rejected'; feedback?: string }) =>
      attendanceApi.verifyLog(p.id, { action: p.action, feedback: p.feedback }),
    onSuccess: () => { setRejecting(null); invalidate() },
  })
  const addBonus = useMutation({
    mutationFn: (v: { hours: number; date: string; reason: string }) => attendanceApi.addManualHours(Number(studentId), v),
    onSuccess: () => { setModal(null); invalidate() },
  })
  const setRequired = useMutation({
    mutationFn: (hours: number) => attendanceApi.updateRequiredHours(Number(studentId), hours),
    onSuccess: () => { setModal(null); invalidate() },
  })
  const decideRequired = useMutation({
    mutationFn: (action: 'approve' | 'reject') => attendanceApi.decideRequiredHours(Number(studentId), action),
    onSuccess: invalidate,
  })

  const logs = logsData?.data ?? []
  const student = summaryData?.student
  const s = summaryData?.data
  const name = student?.name ?? logsData?.student?.name ?? `Student #${studentId}`
  const meta = [student?.office, [student?.academic_year, student?.semester].filter(Boolean).join(' ')].filter(Boolean).join(' · ')

  const required = s?.required ?? logsData?.student?.required_hours ?? 200
  const verified = s?.verified ?? 0
  const remaining = s?.remaining ?? Math.max(0, required - verified)
  const pct = required > 0 ? Math.min(100, (verified / required) * 100) : 0
  const onTrack = pct >= 25
  const pendingRequired = logsData?.student?.pending_required_hours ?? null

  const counts = useMemo(() => ({
    all: logs.length,
    verified: logs.filter((l) => l.status === 'verified').length,
    pending: logs.filter((l) => l.status === 'pending_verification').length,
    rejected: logs.filter((l) => l.status === 'rejected').length,
  }), [logs])

  const filtered = logs.filter((l) =>
    tab === 'all' ? true : tab === 'pending' ? l.status === 'pending_verification' : l.status === tab)

  // Group by date, preserving the backend's newest-first order.
  const groups = useMemo(() => {
    const order: string[] = []
    const by: Record<string, TimeLog[]> = {}
    for (const l of filtered) {
      const key = l.date
      if (!by[key]) { by[key] = []; order.push(key) }
      by[key].push(l)
    }
    return order.map((date) => {
      const items = by[date]
      const total = items.reduce((sum, l) => sum + (Number(l.duration_hours) || 0), 0)
      const d = new Date(date + 'T00:00:00')
      return { date, weekday: format(d, 'EEEE'), label: format(d, 'MMM d, yyyy'), total: `${fmtDur(total)} logged`, items }
    })
  }, [filtered])

  const TABS: [Tab, string][] = [['all', 'All'], ['verified', 'Verified'], ['pending', 'Pending'], ['rejected', 'Rejected']]
  const busy = verify.isPending

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <Link href={`/supervisor/students/${studentId}`}
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#8A7A73] hover:text-[#7C1B26] transition-colors">
        <ArrowLeft className="h-[18px] w-[18px]" /> Back to students
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} avatarUrl={student?.avatar_url}
            className="h-[54px] w-[54px] rounded-[14px] font-serif text-[22px] font-semibold text-[#F3D9A0]"
            style={{ background: 'linear-gradient(160deg,#8A2230,#651420)' }} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Attendance Logs</p>
            <h1 className="font-serif text-[30px] font-medium leading-none text-[#241715]">{name}</h1>
            {meta && <p className="mt-1.5 text-[13px] text-[#8A7A73]">{meta}</p>}
          </div>
        </div>
        <button onClick={() => setModal('bonus')}
          className="flex h-11 items-center gap-2 rounded-xl px-[18px] text-[13.5px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,.24)]"
          style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
          <PlusCircle className="h-[19px] w-[19px]" /> Add Bonus Hours
        </button>
      </div>

      {/* pending required-hours change banner (admin → supervisor) */}
      {pendingRequired != null && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#F3E2B8] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-[#92400E]">
            <Target className="h-4 w-4 flex-shrink-0" />
            Admin requested changing required hours from <b>{required}h</b> to <b>{pendingRequired}h</b>.
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <button onClick={() => decideRequired.mutate('approve')} disabled={decideRequired.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#2C7A42] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </button>
            <button onClick={() => decideRequired.mutate('reject')} disabled={decideRequired.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#B0562F] disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* progress hero */}
      <div className="flex flex-wrap overflow-hidden rounded-2xl border border-[#EFE5DA] bg-white">
        <div className="flex-[1_1_340px] p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A38A82]">Service Hours Progress</span>
            <button onClick={() => setModal('required')} title="Adjust required hours"
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{ color: onTrack ? '#2C5A33' : '#9A6B12', background: onTrack ? '#EAF5EC' : '#FBF3E2' }}>
              {onTrack ? 'On track' : 'Behind pace'}
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[40px] font-semibold leading-none tabular-nums text-[#241715]">{fmtHrs(verified)}</span>
            <span className="text-[15px] text-[#8A7A73]">of {required} hrs verified</span>
            <span className="ml-auto font-serif text-[22px] font-semibold tabular-nums text-[#7C1B26]">{Math.round(pct)}%</span>
          </div>
          <div className="my-3.5 h-3 overflow-hidden rounded-full bg-[#F1E7DC]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#7C1B26,#B8434F)' }} />
          </div>
          <p className="text-[12.5px] text-[#8A7A73]">{fmtHrs(remaining)} hrs remaining to complete the requirement</p>
        </div>
        <div className="grid flex-[1_1_260px] grid-cols-3 border-l border-[#EFE5DA]">
          {([['Verified', counts.verified, '#2C5A33'], ['Pending', counts.pending, '#9A6B12'], ['Rejected', counts.rejected, '#B0562F']] as const).map(([label, n, c], i) => (
            <div key={label} className={`px-3.5 py-5 text-center ${i < 2 ? 'border-r border-[#EFE5DA]' : ''}`}>
              <div className="font-serif text-[24px] font-semibold" style={{ color: c }}>{n}</div>
              <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#A38A82]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* filter tabs */}
      <div className="flex items-center gap-4 border-b border-[#ECE1D6] px-0.5">
        {TABS.map(([key, label]) => {
          const on = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              className="-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13.5px]"
              style={{ borderColor: on ? '#7C1B26' : 'transparent', color: on ? '#7C1B26' : '#8A7A73', fontWeight: on ? 600 : 500 }}>
              {label}
              <span className="rounded-full px-2 py-px text-[11px] font-bold"
                style={{ background: on ? '#FBEAEC' : '#F1E7DC', color: on ? '#7C1B26' : '#8A7A73' }}>{counts[key]}</span>
            </button>
          )
        })}
      </div>

      {/* logs */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-[#EFE5DA]/60" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-[15px] border border-dashed border-[#E0D2C4] bg-white py-16 text-center">
          <CalendarX className="mx-auto h-10 w-10 text-[#C9B7AC]" />
          <p className="mt-3 text-[15px] font-semibold text-[#3F2F2A]">No {tab === 'all' ? '' : tab} logs</p>
          <p className="mt-1 text-[13px] text-[#A38A82]">Try another filter to see this student&apos;s other logs.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="space-y-2.5">
            <div className="mb-1 flex items-center gap-3">
              <span className="font-serif text-[15px] font-semibold text-[#3F2F2A]">{g.weekday}</span>
              <span className="text-[12.5px] tabular-nums text-[#A38A82]">{g.label}</span>
              <span className="h-px flex-1 bg-[#ECE1D6]" />
              <span className="text-[11.5px] tabular-nums text-[#B7A692]">{g.total}</span>
            </div>

            {g.items.map((l) => {
              const m = metaOf(l)
              const isOpen = !!expanded[l.id]
              const narrative = narrativeOf(l)
              const showNoNarrative = !narrative && !l.is_manual && l.status !== 'open'
              return (
                <div key={l.id} className="overflow-hidden rounded-[14px] border border-[#EFE5DA] bg-white shadow-[0_2px_7px_rgba(60,30,25,.05)]">
                  <div className="flex items-center gap-4 px-[18px] py-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-white shadow-[0_3px_8px_rgba(60,30,25,.16)]" style={{ background: m.accent }}>
                      {l.is_manual ? <Sparkles className="h-[22px] w-[22px]" /> : <m.Group className="h-[22px] w-[22px]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15.5px] font-bold tabular-nums text-[#241715]">{timeRange(l)}</span>
                        {l.is_manual && <span className="rounded-md bg-[#FBF3E2] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#9A6B12]">Bonus</span>}
                        {l.location_flagged && (
                          <span title="Weak/untrusted GPS at clock-in — review before verifying" className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-[#92400E]">
                            <MapPinOff className="h-3 w-3" /> Location
                          </span>
                        )}
                      </div>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#EFE5DA] bg-[#FBF7F2] px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-[#7C1B26]">
                        <Clock className="h-3.5 w-3.5 text-[#B79B7E]" /> {fmtDur(Number(l.duration_hours) || 0)}
                      </span>
                    </div>
                    <span className="flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ color: m.color, background: m.bg }}>
                      <m.Icon className="h-[15px] w-[15px]" /> {m.label}
                    </span>
                  </div>

                  {narrative && (
                    <>
                      <button onClick={() => setExpanded((e) => { const n = { ...e }; if (n[l.id]) delete n[l.id]; else n[l.id] = true; return n })}
                        className="flex w-full items-center gap-2.5 border-t border-[#F4ECE1] bg-[#FBF7F2] px-[18px] py-2.5 text-left">
                        <FileText className="h-[18px] w-[18px] text-[#7C1B26]" />
                        <span className="flex-1 text-[12.5px] font-semibold text-[#5A4A45]">{isOpen ? 'Hide narrative report' : 'View narrative report'}</span>
                        <ChevronDown className={`h-5 w-5 text-[#B79B7E] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-[#F4ECE1] px-[18px] py-4">
                          {(l.time_in_photo_url || l.location_flag_reason) && (
                            <div className="mb-3 flex items-start gap-3">
                              {l.time_in_photo_url && (
                                <button type="button" onClick={() => setZoomSrc(l.time_in_photo_url!)} title="Click to enlarge"
                                  className="group relative flex-none cursor-zoom-in">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={l.time_in_photo_url} alt="Clock-in selfie" className="h-16 w-12 rounded-lg border border-[#EFE5DA] object-cover transition group-hover:brightness-95" />
                                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                                    <ZoomIn className="h-3.5 w-3.5 text-white" />
                                  </span>
                                </button>
                              )}
                              <div className="min-w-0 text-[12px]">
                                <span className="font-semibold text-[#8A7A73]">{l.time_in_photo_url ? 'Clock-in selfie' : 'No clock-in selfie'}</span>
                                {l.location_flag_reason && (
                                  <p className="mt-1 rounded-md bg-[#FBF3E2] px-2 py-1 font-semibold text-[#9A6B12]">⚠ {l.location_flag_reason}</p>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#A9823C]">Narrative Report</div>
                          <p className="whitespace-pre-line font-serif text-[15.5px] leading-[1.65] text-[#33241F]">{narrative}</p>
                          {l.narrative_report?.challenges && (
                            <p className="mt-3 rounded-lg bg-[#FBF7F2] px-3.5 py-2.5 text-[13px] text-[#5A4A45]">
                              <b className="text-[#8A7A73]">Challenges: </b>{l.narrative_report.challenges}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {l.is_manual && l.manual_reason && (
                    <div className="flex items-start gap-2 border-t border-[#F4ECE1] bg-[#FBF3E2] px-[18px] py-2.5 text-[12.5px] text-[#9A6B12]">
                      <Sparkles className="mt-px h-4 w-4 flex-none" /> <span><b>Bonus:</b> {l.manual_reason}</span>
                    </div>
                  )}

                  {showNoNarrative && (
                    <div className="flex items-center gap-2 border-t border-[#F4ECE1] bg-[#FBF6E9] px-[18px] py-2.5 text-[12.5px] text-[#9A7B2E]">
                      <Info className="h-[17px] w-[17px]" /> No narrative report submitted for this log.
                    </div>
                  )}

                  {l.rejection_reason && (
                    <div className="flex items-start gap-2 border-t border-[#F4ECE1] bg-[#FDF2ED] px-[18px] py-2.5 text-[12.5px] text-[#B0562F]">
                      <Ban className="mt-px h-4 w-4 flex-none" /> <span><b>Rejected —</b> {l.rejection_reason}</span>
                    </div>
                  )}

                  {/* pending → verify / reject inline */}
                  {l.status === 'pending_verification' && (
                    <div className="border-t border-[#F4ECE1] px-[18px] py-3">
                      {rejecting?.id === l.id ? (
                        <div className="space-y-2">
                          <textarea autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ id: l.id, reason: e.target.value })}
                            rows={2} placeholder="Reason for rejection (required)…"
                            className="w-full resize-none rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-[13px] text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setRejecting(null)} className="rounded-lg border border-[#EADFD4] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#7A6A63]">Cancel</button>
                            <button onClick={() => verify.mutate({ id: l.id, action: 'rejected', feedback: rejecting.reason.trim() })}
                              disabled={!rejecting.reason.trim() || busy}
                              className="flex items-center gap-1.5 rounded-lg bg-[#B0562F] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Reject log
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setRejecting({ id: l.id, reason: '' })} disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg border border-[#EADFD4] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#B0562F] hover:bg-[#FDF4F0] disabled:opacity-50">
                            <XCircle className="h-4 w-4" /> Reject
                          </button>
                          <button onClick={() => verify.mutate({ id: l.id, action: 'verified' })} disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12.5px] font-semibold text-[#FFF8F2] disabled:opacity-50"
                            style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
                            <CheckCircle className="h-4 w-4" /> Verify
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}

      {modal === 'bonus' && (
        <ManualHoursModal
          studentName={name}
          isPending={addBonus.isPending}
          error={addBonus.isError ? ((addBonus.error as { message?: string })?.message ?? 'Could not add hours.') : null}
          onClose={() => setModal(null)}
          onSubmit={(v) => addBonus.mutate(v)}
        />
      )}
      {modal === 'required' && (
        <RequiredHoursModal
          current={required}
          isPending={setRequired.isPending}
          error={setRequired.isError ? ((setRequired.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setModal(null)}
          onSubmit={(h) => setRequired.mutate(h)}
        />
      )}

      {/* Selfie lightbox — enlarges over the current page, not a new tab */}
      {zoomSrc && (
        <div onClick={() => setZoomSrc(null)}
          className="fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-black/80 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomSrc} alt="Clock-in selfie" className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-[0_30px_80px_rgba(0,0,0,.6)]" />
          <button onClick={() => setZoomSrc(null)} aria-label="Close"
            className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  )
}
