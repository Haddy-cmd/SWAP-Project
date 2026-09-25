'use client'

import { useMemo } from 'react'
import type { TimeLog } from '@/types/attendance.types'
import {
  buildRow, allDaysVerified, makeControlNo, mondayOf, iso, hrs, issueDateToday,
  SlipBrand, SlipPrintStyles, SignaturePair, Field,
  type Row, type DutySlipIdentity, type DutySlipTerm,
} from './DutySlip'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const sumBy = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0)
const two = (n: number) => n.toFixed(2)

type WeekRow = {
  key: string
  wk: number
  period: string
  daysOnDuty: number
  regular: number
  bonus: number
  status: string
}

/**
 * One-page semester summary: totals against the requirement, a per-week breakdown
 * that lines up with the weekly duty slips, a certification, and the same two
 * signatures (supervisor ink only when every day of the term is verified).
 * Hour rules match the weekly slip: rejected logs are ignored; bonus hours are the
 * supervisor-granted (`is_manual`) logs; total = regular + bonus.
 */
export function SemesterServiceReport({ logs, identity, term }: {
  logs: TimeLog[]
  identity: DutySlipIdentity
  term: DutySlipTerm
}) {
  // Which terms was this student actually a SWAP recipient in? Derived from the terms
  // their logs belong to, plus the current assignment (assigned but not yet logging).
  const recipientThisTerm = useMemo(() => {
    const terms = new Set<string>()
    for (const l of logs) if (l.academic_year && l.semester) terms.add(`${l.academic_year}|${l.semester}`)
    if (identity.academicYear && identity.semester) terms.add(`${identity.academicYear}|${identity.semester}`)
    return terms.has(`${term.academicYear}|${term.semester}`)
  }, [logs, identity.academicYear, identity.semester, term.academicYear, term.semester])

  const data = useMemo(() => {
    const termLogs = logs.filter((l) => l.academic_year === term.academicYear && l.semester === term.semester)

    // Days → rows (same builder as the weekly slip), then rows → Mon–Sun weeks.
    const byDate = new Map<string, TimeLog[]>()
    for (const l of termLogs) {
      const key = (l.date ?? '').slice(0, 10)
      if (!key) continue
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(l)
    }
    const days = [...byDate.keys()].sort().map((k) => buildRow(new Date(k + 'T00:00:00'), byDate.get(k)!))

    const byWeek = new Map<string, Row[]>()
    for (const r of days) {
      const k = iso(mondayOf(r.date))
      if (!byWeek.has(k)) byWeek.set(k, [])
      byWeek.get(k)!.push(r)
    }
    const weekKeys = [...byWeek.keys()].sort()
    const first = weekKeys.length ? new Date(weekKeys[0] + 'T00:00:00').getTime() : 0

    const weeks: WeekRow[] = weekKeys.map((k) => {
      const start = new Date(k + 'T00:00:00')
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const rows = byWeek.get(k)!
      const pendingDays = rows.filter((r) => r.status === 'Unverified').length
      return {
        key: k,
        // Counted from the term's first duty week, so weeks without duty show as gaps.
        wk: Math.round((start.getTime() - first) / WEEK_MS) + 1,
        period: `${fmtDay(start)} – ${fmtDay(end)}`,
        daysOnDuty: rows.filter((r) => r.regularHours + r.bonusHours > 0).length,
        regular: sumBy(rows, (r) => r.regularHours),
        bonus: sumBy(rows, (r) => r.bonusHours),
        status: pendingDays
          ? `${pendingDays} day${pendingDays > 1 ? 's' : ''} pending`
          : rows.some((r) => r.status) ? 'Verified' : 'In progress',
      }
    })

    const live = termLogs.filter((l) => l.status !== 'rejected')
    const hoursWhere = (status: TimeLog['status']) =>
      live.filter((l) => l.status === status).reduce((s, l) => s + (Number(l.duration_hours) || 0), 0)

    return {
      days,
      weeks,
      regular: sumBy(days, (r) => r.regularHours),
      bonus: sumBy(days, (r) => r.bonusHours),
      verified: hoursWhere('verified'),
      pending: hoursWhere('pending_verification'),
      daysOnDuty: days.filter((r) => r.regularHours + r.bonusHours > 0).length,
    }
  }, [logs, term.academicYear, term.semester])

  const total = data.regular + data.bonus
  const isCurrentTerm = term.academicYear === identity.academicYear && term.semester === identity.semester
  const required = isCurrentTerm && identity.requiredHours ? Number(identity.requiredHours) : null
  const remaining = required != null ? Math.max(0, required - data.verified) : null
  const pct = required ? Math.min(100, Math.round((data.verified / required) * 100)) : null

  const ayLabel = term.academicYear.replace('-', '–')
  const termLabel = `${term.semester}${term.academicYear ? `, AY ${ayLabel}` : ''}`
  const controlNo = makeControlNo({
    studentId: identity.studentIdNumber,
    academicYear: term.academicYear,
    semester: term.semester,
    mode: 'semester',
    weekStart: '',
  })
  const noData = !recipientThisTerm

  return (
    <div className="duty-slip mx-auto w-full max-w-[880px] rounded-lg border border-ink-200 bg-white p-7 text-black shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td rowSpan={4} className="w-[52%] border border-black px-3 py-2 align-middle">
                <SlipBrand title="SWAP SEMESTRAL SERVICE REPORT" />
              </td>
              <td className="w-[17%] border border-black px-2 py-1 font-semibold">Semester</td>
              <td className="border border-black px-2 py-1">{termLabel}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Issue Date</td>
              <td className="border border-black px-2 py-1">{issueDateToday()}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Page No.</td>
              <td className="border border-black px-2 py-1">Page 1 of 1</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Control No.</td>
              <td className="border border-black px-2 py-1 font-mono font-semibold tracking-tight">{controlNo}</td>
            </tr>
          </tbody>
        </table>

        {/* Identity */}
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12px]">
          <Field label="Name" value={identity.name} />
          <Field label="Student ID No." value={identity.studentIdNumber ?? ''} />
          <Field label="Course/Year" value={identity.courseYear} />
          <Field label="Office/College Assigned" value={identity.office} />
          <Field label="Immediate Supervisor" value={identity.supervisor} />
          <Field label="Days on Duty" value={noData ? '' : String(data.daysOnDuty)} />
        </div>

        {noData ? (
          <div className="mt-4 border border-black px-2 py-10 text-center text-[12px] text-ink-500">
            No SWAP assignment for {termLabel} — no duty records for this semester.
          </div>
        ) : (
          <>
            {/* Summary against the requirement */}
            <p className="mt-4 text-[11px] font-bold tracking-wide">I. SUMMARY OF SERVICE</p>
            <table className="mt-1 w-full border-collapse text-center text-[11px]">
              <thead>
                <tr>
                  {['REQUIRED', 'REGULAR', 'BONUS', 'TOTAL RENDERED', 'VERIFIED', 'PENDING', 'REMAINING', 'COMPLETION'].map((h) => (
                    <th key={h} className="border border-black px-1 py-1">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-[12px]">
                  <td className="border border-black px-1 py-1.5">{required != null ? two(required) : '—'}</td>
                  <td className="border border-black px-1 py-1.5">{two(data.regular)}</td>
                  <td className="border border-black px-1 py-1.5">{two(data.bonus)}</td>
                  <td className="border border-black px-1 py-1.5 font-bold">{two(total)}</td>
                  <td className="border border-black px-1 py-1.5">{two(data.verified)}</td>
                  <td className="border border-black px-1 py-1.5">{two(data.pending)}</td>
                  <td className="border border-black px-1 py-1.5">{remaining != null ? two(remaining) : '—'}</td>
                  <td className="border border-black px-1 py-1.5 font-semibold">{pct != null ? `${pct}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-ink-600">
              Completion and remaining hours count verified hours only. Bonus hours are credited by the supervisor.
            </p>

            {/* Weekly breakdown — lines up with the weekly duty slips */}
            <p className="mt-4 text-[11px] font-bold tracking-wide">II. WEEKLY BREAKDOWN</p>
            <table className="mt-1 w-full border-collapse text-center text-[11px]">
              <thead>
                <tr>
                  <th className="w-[7%] border border-black px-1 py-1">WK</th>
                  <th className="border border-black px-1 py-1">PERIOD (MON – SUN)</th>
                  <th className="w-[11%] border border-black px-1 py-1">DAYS ON DUTY</th>
                  <th className="w-[11%] border border-black px-1 py-1">REGULAR</th>
                  <th className="w-[10%] border border-black px-1 py-1">BONUS</th>
                  <th className="w-[10%] border border-black px-1 py-1">TOTAL</th>
                  <th className="w-[17%] border border-black px-1 py-1">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-black px-2 py-6 text-ink-500">No duty recorded yet this semester.</td>
                  </tr>
                ) : (
                  data.weeks.map((w) => (
                    <tr key={w.key}>
                      <td className="border border-black px-1 py-1">{w.wk}</td>
                      <td className="border border-black px-2 py-1">{w.period}</td>
                      <td className="border border-black px-1 py-1">{w.daysOnDuty}</td>
                      <td className="border border-black px-1 py-1">{hrs(w.regular) || '—'}</td>
                      <td className="border border-black px-1 py-1">{hrs(w.bonus) || '—'}</td>
                      <td className="border border-black px-1 py-1 font-semibold">{hrs(w.regular + w.bonus) || '—'}</td>
                      <td className="border border-black px-1 py-1">{w.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.weeks.length > 0 && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={2} className="border border-black px-2 py-1 text-right">TOTAL</td>
                    <td className="border border-black px-1 py-1">{data.daysOnDuty}</td>
                    <td className="border border-black px-1 py-1">{two(data.regular)}</td>
                    <td className="border border-black px-1 py-1">{two(data.bonus)}</td>
                    <td className="border border-black px-1 py-1">{two(total)}</td>
                    <td className="border border-black px-1 py-1" />
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Certification */}
            <p className="mt-4 text-[11px] font-bold tracking-wide">III. CERTIFICATION</p>
            <p className="mt-1 text-justify text-[12px] leading-relaxed">
              This is to certify that <b className="uppercase">{identity.name || '________________'}</b>
              {identity.courseYear ? `, ${identity.courseYear},` : ','} a beneficiary of the Student Welfare
              Assistantship Program, has rendered a total of <b>{two(total)} hours</b> of service ({two(data.regular)} regular,{' '}
              {two(data.bonus)} bonus) at <b>{identity.office || 'the assigned office'}</b> for the {termLabel}
              {required != null ? <>, against the required <b>{two(required)} hours</b></> : null}.
              {data.pending > 0 && <> Of these, {two(data.pending)} hours are pending the supervisor&apos;s verification.</>}
            </p>
          </>
        )}

        <SignaturePair
          identity={identity}
          allVerified={!noData && allDaysVerified(data.days)}
          hasDuty={data.days.some((r) => r.status)}
          hideNote={noData}
        />
      </div>

      <SlipPrintStyles orientation="portrait" />
    </div>
  )
}
