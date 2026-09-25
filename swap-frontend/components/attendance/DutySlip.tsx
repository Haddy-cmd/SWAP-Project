'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { avatarSrc } from '@/lib/utils/avatar'
import type { TimeLog } from '@/types/attendance.types'
import { SemesterServiceReport } from './SemesterServiceReport'

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

/** Hours with two decimals, or '' for zero (the printed form shows a fill line instead). */
export const hrs = (n: number) => (n ? n.toFixed(2) : '')

// Deterministic hash → the same inputs always yield the same control number, so
// an admin can regenerate it from the recipient's record to confirm the printed
// slip is legit (and any tampering with the hours breaks the checksum).
function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export function makeControlNo(o: {
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

/** One calendar day of duty, as both slips print it. */
export type Row = {
  dateStr: string
  date: Date
  day: string
  amIn: string
  amOut: string
  pmIn: string
  pmOut: string
  /** Regular (clocked) hours and bonus (supervisor-granted) hours. */
  regularHours: number
  bonusHours: number
  /** '' (nothing completed) | 'Verified' | 'Unverified' — drives the supervisor-ink rule. */
  status: '' | 'Verified' | 'Unverified'
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
  /** Required hours of the current assignment (applies to its term only). */
  requiredHours?: number | null
  /** Specimen URLs (`signature_url` shape; the token is applied at render). */
  supervisorSignatureUrl?: string | null
  beneficiarySignatureUrl?: string | null
}

const sumHours = (ls: TimeLog[]) => ls.reduce((s, l) => s + (Number(l.duration_hours) || 0), 0)

/**
 * One day's row. Rejected logs are ignored entirely. Bonus hours (logs a supervisor
 * granted, `is_manual`) carry a synthetic 8:00 AM time-in, so they are kept out of
 * the AM/PM time columns and counted separately.
 */
export function buildRow(date: Date, dayLogs: TimeLog[]): Row {
  const live = dayLogs.filter((l) => l.status !== 'rejected')
  const regular = live.filter((l) => !l.is_manual)
  const bonus = live.filter((l) => l.is_manual)
  const am = regular.find((l) => (parse(l.time_in)?.getHours() ?? 0) < 12)
  const pm = regular.find((l) => (parse(l.time_in)?.getHours() ?? 0) >= 12)
  const completed = live.filter((l) => l.time_out)
  const status: Row['status'] = completed.length
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
    regularHours: sumHours(regular),
    bonusHours: sumHours(bonus),
    status,
  }
}

/** The supervisor's ink attests the hours shown: only when every completed day is Verified (and there is one). */
export function allDaysVerified(rows: Row[]): boolean {
  const statuses = rows.map((r) => r.status).filter(Boolean)
  return statuses.length > 0 && statuses.every((s) => s === 'Verified')
}

export const issueDateToday = () => {
  const t = new Date()
  return `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}/${t.getFullYear()}`
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
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-ink-100 p-1">
          {(['week', 'semester'] as DutySlipMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-md px-3 py-1.5 text-[13px] font-semibold capitalize transition-colors"
              style={mode === m ? { background: '#fff', color: '#1F5B3A' } : { color: '#6F7B74' }}
            >
              {m === 'week' ? 'This week' : 'Whole semester'}
            </button>
          ))}
        </div>

        {mode === 'week' ? (
          <>
            <button onClick={() => shiftWeek(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50" aria-label="Previous week">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => e.target.value && setWeekStart(iso(mondayOf(new Date(e.target.value + 'T00:00:00'))))}
              className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
            />
            <button onClick={() => shiftWeek(1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50" aria-label="Next week">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setTerm(stepTerm(term, -1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50" aria-label="Previous semester">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="flex h-10 min-w-[150px] items-center justify-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900">
              {shortTerm(term)}
            </span>
            <button onClick={() => setTerm(stepTerm(term, 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50" aria-label="Next semester">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        <button
          onClick={() => window.print()}
          className="ml-1 flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          <Printer className="h-4 w-4" /> Print / Download
        </button>
      </div>
    </div>
  )
}

// ── the printable document ───────────────────────────────────────────────────
type DocumentProps = {
  mode: DutySlipMode
  weekStart: string
  logs: TimeLog[]
  identity: DutySlipIdentity
  term: DutySlipTerm
}

/** Week → the official weekly duty slip; semester → the one-page Semestral Service Report. */
export function DutySlipDocument(props: DocumentProps) {
  // Two distinct components (not a branch inside one), so switching modes never
  // changes the hook order of a mounted component.
  return props.mode === 'semester'
    ? <SemesterServiceReport logs={props.logs} identity={props.identity} term={props.term} />
    : <WeeklyDutySlip weekStart={props.weekStart} logs={props.logs} identity={props.identity} />
}

function WeeklyDutySlip({ weekStart, logs, identity }: { weekStart: string; logs: TimeLog[]; identity: DutySlipIdentity }) {
  // The full week (Mon–Sun) — night and Sunday duty count as regular hours, so
  // every day of the week gets a row.
  const { rows, regularTotal, bonusTotal, periodLabel } = useMemo(() => {
    const start = new Date(weekStart + 'T00:00:00')
    const rows = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return buildRow(d, logs.filter((l) => (l.date ?? '').slice(0, 10) === iso(d)))
    })
    return {
      rows,
      regularTotal: rows.reduce((s, r) => s + r.regularHours, 0),
      bonusTotal: rows.reduce((s, r) => s + r.bonusHours, 0),
      periodLabel: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    }
  }, [weekStart, logs])

  const totalHours = regularTotal + bonusTotal

  const controlNo = makeControlNo({
    studentId: identity.studentIdNumber,
    academicYear: identity.academicYear,
    semester: identity.semester,
    mode: 'week',
    weekStart,
  })

  return (
    <div className="duty-slip mx-auto w-full max-w-[1000px] rounded-lg border border-ink-200 bg-white p-6 text-black shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header table */}
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td rowSpan={5} className="w-[46%] border border-black px-3 py-2 align-middle">
                <SlipBrand title="SWAP WEEKLY DUTY SLIP" />
              </td>
              <td className="w-[16%] border border-black px-2 py-1 font-semibold">Doc. Code:</td>
              <td className="border border-black px-2 py-1">MSU DSA SWAP Weekly Duty Form No.1.6</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold">Issue Date</td>
              <td className="border border-black px-2 py-1">{issueDateToday()}</td>
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
          <Field label="Month" value={periodLabel} />
        </div>

        {/* Duty table */}
        <table className="mt-3 w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black px-1 py-1">DATE</th>
              <th rowSpan={2} className="border border-black px-1 py-1">DAY</th>
              <th colSpan={2} className="border border-black px-1 py-1">AM</th>
              <th colSpan={2} className="border border-black px-1 py-1">PM</th>
              <th rowSpan={2} className="border border-black px-1 py-1">BONUS</th>
              <th rowSpan={2} className="border border-black px-1 py-1">TOTAL</th>
            </tr>
            <tr>
              <th className="border border-black px-1 py-1">TIME IN</th>
              <th className="border border-black px-1 py-1">TIME OUT</th>
              <th className="border border-black px-1 py-1">TIME IN</th>
              <th className="border border-black px-1 py-1">TIME OUT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <RowGroup key={r.dateStr} r={r} />)}
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-3 flex items-end gap-2 text-[12px]">
          <span className="font-semibold">Total number of hours:</span>
          <span className="min-w-[120px] border-b border-black px-2 text-center font-bold">{hrs(totalHours)}</span>
          {bonusTotal > 0 && <span className="text-[11px]">(incl. {bonusTotal.toFixed(2)} bonus)</span>}
        </div>

        <SignaturePair identity={identity} allVerified={allDaysVerified(rows)} hasDuty={rows.some((r) => r.status)} />
      </div>

      {/* Portrait keeps the whole form — signatures included — on one A4 page. */}
      <SlipPrintStyles orientation="portrait" />
    </div>
  )
}

// ── shared building blocks (also used by SemesterServiceReport) ──────────────

/** Seal + institutional lines + the document title, for the header's left cell. */
export function SlipBrand({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/dsa-logo.png" alt="DSA" width={54} height={54} className="flex-none" />
      <div className="leading-tight">
        <p className="text-[13px] font-bold">MINDANAO STATE UNIVERSITY</p>
        <p className="text-[11px]">Marawi City</p>
        <p className="text-[12px] font-bold">DIVISION OF STUDENT AFFAIRS</p>
        <p className="text-[12px] font-bold">{title}</p>
      </div>
    </div>
  )
}

/** Print only the document, on A4 in the given orientation. */
export function SlipPrintStyles({ orientation }: { orientation: 'portrait' | 'landscape' }) {
  return (
    <style>{`
      @media print {
        html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
        body * { visibility: hidden !important; }
        .duty-slip, .duty-slip * { visibility: visible !important; }
        .duty-slip { position: absolute; left: 0; top: 0; width: 100%; padding: 0; overflow: visible !important; }
        .no-print { display: none !important; }
        @page { size: A4 ${orientation}; margin: 12mm; }
      }
    `}</style>
  )
}

/** Immediate Supervisor + SWAP Beneficiary blocks with drawn signatures. */
export function SignaturePair({ identity, allVerified, hasDuty, hideNote = false }: {
  identity: DutySlipIdentity
  allVerified: boolean
  /** At least one completed day on the document — picks the explanation for withheld ink. */
  hasDuty: boolean
  /** Suppress the hint entirely (e.g. a term with no assignment). */
  hideNote?: boolean
}) {
  const token = useAuthStore((s) => s.token)
  const supervisorInk = allVerified ? avatarSrc(identity.supervisorSignatureUrl, token) : null
  const beneficiaryInk = avatarSrc(identity.beneficiarySignatureUrl, token)

  return (
    <div className="mx-auto mt-6 grid max-w-[720px] grid-cols-2 gap-10 text-center text-[11px]">
      <div>
        <SignatureBlock ink={supervisorInk} line={identity.supervisor} role="Immediate Supervisor" sub="Name & Signature" />
        {!allVerified && !hideNote && identity.supervisorSignatureUrl && (
          <p className="no-print mt-1.5 text-[11px] text-ink-500">
            {hasDuty
              ? 'The supervisor’s signature appears once every day on this slip is verified.'
              : 'No duty on this slip — the supervisor’s signature appears once there are verified hours.'}
          </p>
        )}
      </div>
      <SignatureBlock ink={beneficiaryInk} line={identity.name} role="SWAP Beneficiary Signature" sub="" />
    </div>
  )
}

/** A horizontal rule used to fill empty cells so nothing can be hand-written in after printing. */
function Line() {
  return <span className="mx-auto block h-[1.5px] w-3/4 bg-black" />
}

function Cell({ v, className = '' }: { v: string; className?: string }) {
  return <td className={`border border-black px-1 py-1.5 align-middle ${className}`}>{v ? v : <Line />}</td>
}

export function Field({ label, value }: { label: string; value: string }) {
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
        <Cell v={hrs(r.bonusHours)} />
        {/* The day's total includes its bonus hours. */}
        <Cell v={hrs(r.regularHours + r.bonusHours)} className="font-semibold" />
      </tr>
      <tr>
        <td colSpan={8} className="border border-black px-2 py-1.5 text-left">Task Description:</td>
      </tr>
    </>
  )
}

function SignatureBlock({ ink, line, role, sub }: { ink?: string | null; line: string; role: string; sub: string }) {
  // A missing or forbidden specimen (404/403) hides the image and leaves the typed name.
  const [failed, setFailed] = useState<string | null>(null)
  const showInk = !!ink && failed !== ink

  return (
    <div>
      {/* Fixed signing cell: both blocks reserve the same space above the rule. */}
      <div className="flex h-10 items-end justify-center">
        {showInk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ink!} alt="" onError={() => setFailed(ink!)} className="max-h-10 max-w-[180px] object-contain" />
        )}
      </div>
      <div className="mx-auto mb-1 h-4 border-b border-black text-[12px] font-semibold">{line || ' '}</div>
      <p className="font-bold">{role}</p>
      {sub && <p>{sub}</p>}
    </div>
  )
}
