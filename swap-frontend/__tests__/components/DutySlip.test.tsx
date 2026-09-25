import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { TimeLog } from '@/types/attendance.types'
import {
  buildRow, allDaysVerified, DutySlipDocument, type DutySlipIdentity,
} from '@/components/attendance/DutySlip'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ priority: _p, ...props }: Record<string, unknown>) => <img {...(props as object)} />,
}))

const AY = '2024-2025'
const SEM = '1st Semester'

/**
 * A completed log from HH:MM *Manila time* for `hours` hours on `date`, with the
 * timestamps shaped exactly like TimeLogResource sends them (UTC ISO strings) —
 * so the tests pass whatever time zone the machine running them is in.
 */
function log(date: string, start: string, hours: number, extra: Partial<TimeLog> = {}): TimeLog {
  const timeIn = new Date(`${date}T${start}:00+08:00`)
  const timeOut = new Date(timeIn.getTime() + hours * 3_600_000)
  return {
    id: Math.floor(Math.random() * 1e9),
    date,
    time_in: timeIn.toISOString(),
    time_out: timeOut.toISOString(),
    duration_hours: hours,
    status: 'verified',
    academic_year: AY,
    semester: SEM,
    is_manual: false,
    has_narrative: false,
    ...extra,
  } as TimeLog
}

const identity: DutySlipIdentity = {
  name: 'Norhana Macarimbang',
  courseYear: 'BSMATH - 4',
  office: 'ICT Center',
  supervisor: 'Prof. Sittie Hadja',
  studentIdNumber: '2019-0004',
  academicYear: AY,
  semester: SEM,
  requiredHours: 20,
}

describe('buildRow', () => {
  it('prints clock times and splits AM/PM in Manila time, not the device zone', () => {
    // 01:30Z and 05:00Z are 9:30 AM and 1:00 PM in Manila — but 1:30 AM / 5:00 AM
    // on a UTC machine, which used to land both in the AM column.
    const row = buildRow(new Date('2024-09-02T00:00:00'), [
      { ...log('2024-09-02', '09:30', 2), time_in: '2024-09-02T01:30:00.000Z', time_out: '2024-09-02T03:30:00.000Z' },
      { ...log('2024-09-02', '13:00', 3), time_in: '2024-09-02T05:00:00.000Z', time_out: '2024-09-02T08:00:00.000Z' },
    ])

    expect(row.amIn).toBe('9:30 AM')
    expect(row.amOut).toBe('11:30 AM')
    expect(row.pmIn).toBe('1:00 PM')
    expect(row.pmOut).toBe('4:00 PM')
  })

  it('keeps bonus hours out of the time columns and ignores rejected logs', () => {
    const row = buildRow(new Date('2024-09-02T00:00:00'), [
      log('2024-09-02', '08:00', 2, { is_manual: true, manual_reason: 'Event duty' }), // synthetic 8:00 AM
      log('2024-09-02', '13:00', 4),
      log('2024-09-02', '09:00', 3, { status: 'rejected' }),
    ])

    expect(row.amIn).toBe('')           // the bonus log's fake 8:00 AM never prints
    expect(row.pmIn).toBe('1:00 PM')
    expect(row.regularHours).toBe(4)
    expect(row.bonusHours).toBe(2)
    expect(row.status).toBe('Verified') // the rejected log doesn't block verification
  })

  it('marks a day with a pending log as Unverified', () => {
    const row = buildRow(new Date('2024-09-02T00:00:00'), [log('2024-09-02', '08:00', 4, { status: 'pending_verification' })])
    expect(row.status).toBe('Unverified')
    expect(allDaysVerified([row])).toBe(false)
    expect(allDaysVerified([])).toBe(false) // nothing to attest → no ink
  })
})

describe('weekly duty slip', () => {
  it('prints a BONUS column and the bonus inside the total', () => {
    render(
      <DutySlipDocument
        mode="week"
        weekStart="2024-09-02"
        term={{ academicYear: AY, semester: SEM }}
        identity={identity}
        logs={[log('2024-09-02', '13:00', 4), log('2024-09-03', '08:00', 2, { is_manual: true })]}
      />,
    )

    expect(screen.getByText('SWAP WEEKLY DUTY SLIP')).toBeInTheDocument()

    // BONUS comes before TOTAL, so the bonus reads as part of the day's total.
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers.indexOf('BONUS')).toBeGreaterThan(-1)
    expect(headers.indexOf('BONUS')).toBeLessThan(headers.indexOf('TOTAL'))

    // Tue is bonus-only: BONUS 2.00 and TOTAL 2.00 (the total includes it).
    const tue = screen.getByText('Tue').closest('tr')!
    expect(within(tue).getAllByText('2.00')).toHaveLength(2)

    expect(screen.getByText('6.00')).toBeInTheDocument()              // total = 4 regular + 2 bonus
    expect(screen.getByText('(incl. 2.00 bonus)')).toBeInTheDocument()
    expect(screen.queryByText(/SWAP Mentor\/Verifier/)).not.toBeInTheDocument()
  })

  it('explains withheld supervisor ink on a week with no duty', () => {
    render(
      <DutySlipDocument
        mode="week"
        weekStart="2026-09-21"
        term={{ academicYear: AY, semester: SEM }}
        identity={{ ...identity, supervisorSignatureUrl: 'http://api.test/api/users/2/signature?v=abc' }}
        logs={[]}
      />,
    )
    expect(screen.getByText(/No duty on this slip/)).toBeInTheDocument()
  })
})

describe('semestral service report', () => {
  it('summarises the term by week, with totals and a certification', () => {
    render(
      <DutySlipDocument
        mode="semester"
        weekStart="2024-09-02"
        term={{ academicYear: AY, semester: SEM }}
        identity={identity}
        logs={[
          log('2024-09-02', '08:00', 4),                                  // week 1
          log('2024-09-03', '08:00', 2, { is_manual: true }),             // week 1, bonus
          log('2024-09-17', '13:00', 3, { status: 'pending_verification' }), // week 3 (gap at week 2)
          log('2024-09-18', '08:00', 5, { status: 'rejected' }),          // never counts
          log('2025-02-03', '08:00', 8, { semester: '2nd Semester' }),    // other term
        ]}
      />,
    )

    expect(screen.getByText('SWAP SEMESTRAL SERVICE REPORT')).toBeInTheDocument()
    expect(screen.queryByText('Doc. Code:')).not.toBeInTheDocument()

    const table = screen.getByText('PERIOD (MON – SUN)').closest('table')!
    const rows = within(table).getAllByRole('row')
    // header + week 1 + week 3 + totals
    expect(rows).toHaveLength(4)
    expect(within(rows[1]).getByText('Sep 2 – Sep 8')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Verified')).toBeInTheDocument()
    expect(within(rows[2]).getByText('3')).toBeInTheDocument()        // WK keeps the gap
    expect(within(rows[2]).getByText('1 day pending')).toBeInTheDocument()
    expect(within(rows[3]).getAllByText('9.00').length).toBeGreaterThan(0) // 4 + 2 + 3, rejected excluded

    // Required 20 applies (current term); remaining counts verified hours only (20 − 6).
    expect(screen.getByText('14.00')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText(/Of these, 3.00 hours are pending/)).toBeInTheDocument()
  })

  it('shows the no-assignment notice for a term the student was never assigned to', () => {
    render(
      <DutySlipDocument
        mode="semester"
        weekStart="2024-09-02"
        term={{ academicYear: '2022-2023', semester: SEM }}
        identity={identity}
        logs={[log('2024-09-02', '08:00', 4)]}
      />,
    )
    expect(screen.getByText(/No SWAP assignment for 1st Semester, AY 2022–2023/)).toBeInTheDocument()
    expect(screen.queryByText('II. WEEKLY BREAKDOWN')).not.toBeInTheDocument()
  })
})
