import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const getCurrentLog = vi.fn()
const getMyAssignment = vi.fn()
vi.mock('@/lib/api/attendance.api', () => ({
  attendanceApi: { getCurrentLog: () => getCurrentLog(), getMyAssignment: () => getMyAssignment() },
}))

import { ClockConfirmSheet } from '@/components/attendance/ClockConfirmSheet'

describe('ClockConfirmSheet', () => {
  beforeEach(() => { getCurrentLog.mockResolvedValue(null) })

  it('says clock-in is closed before any location is asked for', async () => {
    getMyAssignment.mockResolvedValue({ office: { name: 'CICS' }, selfie_required: false, clock_in_closed: 'Clock-in is only available between 6:00 AM and 5:30 PM.' })
    render(<ClockConfirmSheet onChoose={() => {}} onCancel={() => {}} />)

    expect(await screen.findByText(/only available between 6:00 AM and 5:30 PM/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Clock in/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers Clock in when open (and for a System Testing account, which gets null)', async () => {
    getMyAssignment.mockResolvedValue({ office: { name: 'CICS' }, selfie_required: false, clock_in_closed: null })
    render(<ClockConfirmSheet onChoose={() => {}} onCancel={() => {}} />)

    expect(await screen.findByText(/not clocked in\./)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Clock in/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})
