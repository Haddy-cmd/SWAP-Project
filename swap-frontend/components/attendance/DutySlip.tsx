'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TimeLog } from '@/types/attendance.types'

// ── shared date helpers ──────────────────────────────────────────────────────
export function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay() // 0 Sun … 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parse = (s?: string | null) => (s ? new Date(s.replace(' ', 'T')) : null)
const fmtTime = (s?: string | null) => {
  const d = parse(s)
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The week is always seven rows; the semester pads up to this same minimum so both
// tabs print the same complete, consistent grid.
const MIN_ROWS = 7

// Deterministic hash → the same inputs always yield the same control number, so
// an admin can regenerate it from the recipient's record to confirm the printed
// slip is legit (and any tampering with the hours breaks the checksum).
function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

function makeControlNo(o: {
  studentId?: string | null
  academicYear?: string | null
  semester?: string | null
  mode: DutySlipMode
  weekStart: string
}): string {
  const sid = (o.studentId ?? 'NA').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'NA'
  const yrs = (o.academicYear ?? '').match(/\d{4}/g) ?? []
  const y1 = yrs[0] ?? ''
  const y2 = yrs[1] ?? ''
  const ay = y1 && y2 ? y1.slice(2) + y2.slice(2) // 2024-2025 → 2425
    : y1 ? y1.slice(2) + '00' : '0000'
  const sem = /2/.test(o.semester ?? '') ? 'S2' : /sum/i.test(o.semester ?? '') ? 'SM' : 'S1'
  const range = o.mode === 'semester' ? 'SEM' : 'W' + o.weekStart.replace(/-/g, '') // W + YYYYMMDD
  const checksum = djb2(`${sid}|${ay}|${sem}|${range}`)
    .toString(36).toUpperCase().padStart(6, '0').slice(-6)
  return `SWAP-${sid}-${ay}${sem}-${range}-${checksum}`
}

type Row = {
  dateStr: string
  date: Date
  day: string
  amIn: string
  amOut: string
  pmIn: string
  pmOut: string
  total: string
  status: string
}

export type DutySlipMode = 'week' | 'semester'

/** A specific academic term, e.g. { academicYear: '2024-2025', semester: '1st Semester' }. */
export interface DutySlipTerm {
  academicYear: string
  semester: string
}

// The three terms of an MSU academic year, in calendar order.
const SEMS = ['1st Semester', '2nd Semester', 'Summer']

/** Step one term forward (+1) or back (-1), rolling over the academic year at the ends. */
export function stepTerm(t: DutySlipTerm, dir: 1 | -1): DutySlipTerm {
  const idx = Math.max(0, SEMS.indexOf(t.semester))
  const [y1, y2] = t.academicYear.split('-').map(Number)
  let next = idx + dir
  let a = y1
  let b = y2
  if (next > SEMS.length - 1) { next = 0; if (!isNaN(a)) a++; if (!isNaN(b)) b++ }
  else if (next < 0) { next = SEMS.length - 1; if (!isNaN(a)) a--; if (!isNaN(b)) b-- }
  const academicYear = !isNaN(a) && !isNaN(b) ? `${a}-${b}` : t.academicYear
  return { academicYear, semester: SEMS[next] }
}

/** Compact label for the nav, e.g. "1st Sem · 2024–2025". */
export function shortTerm(t: DutySlipTerm): string {
  const sem = t.semester.replace('Semester', 'Sem').trim()
  return t.academicYear ? `${sem} · ${t.academicYear.replace('-', '–')}` : sem
}

/** Everything the printed slip states about who the duty was rendered by. */
export interface DutySlipIdentity {
  name: string
  courseYear: string
  office: string
  supervisor: string
  studentIdNumber?: string | null
  academicYear?: string | null
  semester?: string | null
}

function buildRow(date: Date, dayLogs: TimeLog[]): Row {
  const am = dayLogs.find((l) => (parse(l.time_in)?.getHours() ?? 0) < 12)
  const pm = dayLogs.find((l) => (parse(l.time_in)?.getHours() ?? 0) >= 12)
  const dayTotal = dayLogs.reduce((s, l) => s + (Number(l.duration_hours) || 0), 0)
  const completed = dayLogs.filter((l) => l.time_out)
  const status = completed.length
    ? (completed.every((l) => l.status === 'verified') ? 'Verified' : 'Unverified')
    : ''
  return {
    dateStr: iso(date),
    date,
    day: DAYS[date.getDay()],
    amIn: fmtTime(am?.time_in),
    amOut: fmtTime(am?.time_out),
    pmIn: fmtTime(pm?.time_in),
    pmOut: fmtTime(pm?.time_out),
    total: dayTotal ? dayTotal.toFixed(2) : '',
    status,
  }
}

// ── controls (mode toggle · week nav · print) ────────────────────────────────
export function DutySlipControls({
  title, subtitle, mode, setMode, weekStart, setWeekStart, term, setTerm,
}: {
  title: string
  subtitle: string
  mode: DutySlipMode
  setMode: (m: DutySlipMode) => void
  weekStart: string
  setWeekStart: (s: string) => void
  term: DutySlipTerm
  setTerm: (t: DutySlipTerm) => void
}) {
  const shiftWeek = (weeks: number) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    setWeekStart(iso(d))
  }

  return (
    <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">{title}</h1>
        <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-[#F1E7DC] p-1">
          {(['week', 'semester'] as DutySlipMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-md px-3 py-1.5 text-[13px] font-semibold capitalize transition-colors"
              style={mode === m ? { background: '#fff', color: '#7C1B26' } : { color: '#8A7A73' }}
            >
              {m === 'week' ? 'This week' : 'Whole semester'}
            </button>
          ))}
        </div>

        {mode === 'week' ? (
          <>
            <button onClick={() => shiftWeek(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]" aria-label="Previous week">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => e.target.value && setWeekStart(iso(mondayOf(new Date(e.target.value + 'T00:00:00'))))}
              className="h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] focus:border-[#7C1B26] focus:outline-none"
            />
            <button onClick={() => shiftWeek(1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]" aria-label="Next week">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setTerm(stepTerm(term, -1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]" aria-label="Previous semester">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="flex h-10 min-w-[150px] items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-semibold text-[#1E293B]">
              {shortTerm(term)}
            </span>
            <button onClick={() => setTerm(stepTerm(term, 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]" aria-label="Next semester">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        <button
          onClick={() => window.print()}
          className="ml-1 flex h-10 items-center gap-2 rounded-lg bg-[#7C1B26] px-5 text-sm font-semibold text-white hover:bg-[#86202E] transition-colors"
        >
          <Printer className="h-4 w-4" /> Print / Download
        </button>
      </div>
    </div>
  )
}

// ── the printable slip ───────────────────────────────────────────────────────
export function DutySlipDocument({
  mode, weekStart, logs, identity, term,
}: {
  mode: DutySlipMode
  weekStart: string
  logs: TimeLog[]
  identity: DutySlipIdentity
  term: DutySlipTerm
}) {
  // In semester mode the slip is scoped to the selected term; a term the student
  // was never assigned to has no data to show (see recipientThisTerm below).
  const inSemester = mode === 'semester'
  const slipAy = inSemester ? term.academicYear : (identity.academicYear ?? '')
  const slipSem = inSemester ? term.semester : (identity.semester ?? '')

  // Which terms was this student actually a SWAP recipient in? Derived from the terms
  // their logs belong to, plus the current assignment (they may be assigned but not
  // yet have logged any duty).
  const recipientThisTerm = useMemo(() => {
    const terms = new Set<string>()
    for (const l of logs) if (l.academic_year && l.semester) terms.add(`${l.academic_year}|${l.semester}`)
    if (identity.academicYear && identity.semester) terms.add(`${identity.academicYear}|${identity.semester}`)
    return terms.has(`${term.academicYear}|${term.semester}`)
  }, [logs, identity.academicYear, identity.semester, term.academicYear, term.semester])

  const { rows, totalHours, periodLabel } = useMemo(() => {
    if (mode === 'semester') {
      // Only this term's logs, one row per date with activity, ascending.
      const termLogs = logs.filter((l) => l.academic_year === term.academicYear && l.semester === term.semester)
      const byDate = new Map<string, TimeLog[]>()
      for (const l of termLogs) {
        const key = (l.date ?? '').slice(0, 10)
        if (!key) continue
        if (!byDate.has(key)) byDate.set(key, [])
        byDate.get(key)!.push(l)
      }
      const rows = [...byDate.keys()].sort().map((k) => buildRow(new Date(k + 'T00:00:00'), byDate.get(k)!))
      const total = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
      const label = `${term.semester}${term.academicYear ? `, AY ${term.academicYear}` : ''}`
      return { rows, totalHours: total, periodLabel: label }
    }

    // Week mode: the full week (Mon–Sun) — night and Sunday duty count as
    // regular hours, so every day of the week gets a row.
    const start = new Date(weekStart + 'T00:00:00')
    let total = 0
    const rows = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const row = buildRow(d, logs.filter((l) => (l.date ?? '').slice(0, 10) === iso(d)))
      total += parseFloat(row.total) || 0
      return row
    })
    return { rows, totalHours: total, periodLabel: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }) }
  }, [mode, weekStart, logs, term.semester, term.academicYear])

  const today = new Date()
  const issueDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`

  const noData = inSemester && !recipientThisTerm

  const controlNo = makeControlNo({
    studentId: identity.studentIdNumber,
    academicYear: slipAy,
    semester: slipSem,
    mode,
    weekStart,
  })

  return (
    <div className="duty-slip mx-auto w-full max-w-[1000px] rounded-lg border border-[#E2E8F0] bg-white p-6 text-black shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header table */}
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td rowSpan={5} className="w-[46%] border border-black px-3 py-2 align-middle">
                <div className="flex items-center gap-3">
                  <Image src="/dsa-logo.png" alt="DSA" width={54} height={54} className="flex-none" />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold">MINDANAO STATE UNIVERSITY</p>
                    <p className="text-[11px]">Marawi City</p>
                    <p className="text-[12px] font-bold">DIVISION OF STUDENT AFFAIRS</p>
                    <p className="text-[12px] font-bold">SWAP WEEKLY DUTY SLIP</p>
                  </div>
                </div>
              </td>
              <td className="w-[16%] border border-black px-2 py-1 font-semibold">Doc. Code:</td>
              <td className="border border-black px-2 py-1">MSU DSA SWAP Weekly Duty Form No.1.6</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Issue Date</td>
              <td className="border border-black px-2 py-1">{issueDate}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Revision No.</td>
              <td className="border border-black px-2 py-1">3</td>
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

        {/* Identity line */}
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12px]">
          <Field label="Name" value={identity.name} />
          <Field label="Course/Year" value={identity.courseYear} />
          <Field label="Office/College Assigned" value={identity.office} />
          <Field label={mode === 'semester' ? 'Semester' : 'Month'} value={periodLabel} />
        </div>

        {/* Duty table */}
        <table className="mt-3 w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black px-1 py-1">DATE</th>
              <th rowSpan={2} className="border border-black px-1 py-1">DAY</th>
              <th colSpan={2} className="border border-black px-1 py-1">AM</th>
              <th colSpan={2} className="border border-black px-1 py-1">PM</th>
              <th rowSpan={2} className="border border-black px-1 py-1">TOTAL</th>
              <th rowSpan={2} className="border border-black px-1 py-1">Immediate<br />Supervisor</th>
            </tr>
            <tr>
              <th className="border border-black px-1 py-1">TIME IN</th>
              <th className="border border-black px-1 py-1">TIME OUT</th>
              <th className="border border-black px-1 py-1">TIME IN</th>
              <th className="border border-black px-1 py-1">TIME OUT</th>
            </tr>
          </thead>
          <tbody>
            {noData ? (
              <tr>
                <td colSpan={8} className="border border-black px-2 py-8 text-center text-[#64748B]">
                  No SWAP assignment for {periodLabel} — no duty records for this semester.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((r) => <RowGroup key={r.dateStr} r={r} />)}
                {/* Pad out to a full grid so an empty or sparse semester prints as the
                    same complete form as the week — never a collapsed box. */}
                {Array.from({ length: Math.max(0, MIN_ROWS - rows.length) }).map((_, i) => (
                  <BlankRowGroup key={`blank-${i}`} />
                ))}
              </>
            )}
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-3 flex items-end gap-2 text-[12px]">
          <span className="font-semibold">Total number of hours:</span>
          <span className="min-w-[120px] border-b border-black px-2 text-center font-bold">
            {totalHours ? totalHours.toFixed(2) : ''}
          </span>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-center text-[11px]">
          <SignatureBlock line={identity.supervisor} role="Immediate Supervisor" sub="Name & Signature" />
          <SignatureBlock line={identity.name} role="SWAP Beneficiary Signature" sub="" />
          <SignatureBlock line="" role="SWAP Mentor/Verifier" sub="Name & Signature" />
        </div>
      </div>

      {/* Print isolation styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .duty-slip, .duty-slip * { visibility: visible !important; }
          .duty-slip { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>
    </div>
  )
}

/** A horizontal rule used to fill empty cells so nothing can be hand-written in after printing. */
function Line() {
  return <span className="mx-auto block h-[1.5px] w-3/4 bg-black" />
}

function Cell({ v }: { v: string }) {
  return <td className="border border-black px-1 py-1.5 align-middle">{v ? v : <Line />}</td>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="whitespace-nowrap font-semibold">{label}:</span>
      <span className="flex-1 border-b border-black px-1 text-[12px]">{value || ' '}</span>
    </div>
  )
}

function RowGroup({ r }: { r: Row }) {
  const dateLabel = r.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <>
      <tr>
        <td className="border border-black px-1 py-1.5">{dateLabel}</td>
        <td className="border border-black px-1 py-1.5">{r.day}</td>
        <Cell v={r.amIn} />
        <Cell v={r.amOut} />
        <Cell v={r.pmIn} />
        <Cell v={r.pmOut} />
        <td className="border border-black px-1 py-1.5 font-semibold align-middle">{r.total ? r.total : <Line />}</td>
        <Cell v={r.status} />
      </tr>
      <tr>
        <td colSpan={8} className="border border-black px-2 py-1.5 text-left">Task Description:</td>
      </tr>
    </>
  )
}

/** An empty date/day/AM/PM row, so the printed grid stays a fillable form when there's little data. */
function BlankRowGroup() {
  return (
    <>
      <tr>
        {Array.from({ length: 8 }).map((_, i) => (
          <td key={i} className="border border-black px-1 py-1.5">&nbsp;</td>
        ))}
      </tr>
      <tr>
        <td colSpan={8} className="border border-black px-2 py-1.5 text-left">Task Description:</td>
      </tr>
    </>
  )
}

function SignatureBlock({ line, role, sub }: { line: string; role: string; sub: string }) {
  return (
    <div className="pt-4">
      <div className="mx-auto mb-1 h-4 border-b border-black text-[12px] font-semibold">{line || ' '}</div>
      <p className="font-bold">{role}</p>
      {sub && <p>{sub}</p>}
    </div>
  )
}
