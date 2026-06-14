import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HoursProgress } from '@/components/attendance/HoursProgress'
import type { HoursSummary } from '@/types/attendance.types'

const mockSummary: HoursSummary = {
  required: 240,
  rendered: 120,
  verified: 100,
  pending: 20,
  rejected: 5,
  remaining: 140,
}

describe('HoursProgress', () => {
  it('renders verified hours label', () => {
    render(<HoursProgress summary={mockSummary} />)
    expect(screen.getByText('Verified Hours')).toBeInTheDocument()
  })

  it('renders pending verification label', () => {
    render(<HoursProgress summary={mockSummary} />)
    expect(screen.getByText('Pending Verification')).toBeInTheDocument()
  })

  it('renders remaining hours needed section', () => {
    render(<HoursProgress summary={mockSummary} />)
    expect(screen.getByText('Remaining Hours Needed')).toBeInTheDocument()
  })

  it('shows rejected section when rejected > 0', () => {
    render(<HoursProgress summary={mockSummary} />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('hides rejected section when rejected = 0', () => {
    const noReject: HoursSummary = { ...mockSummary, rejected: 0 }
    render(<HoursProgress summary={noReject} />)
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument()
  })

  it('displays remaining hours value', () => {
    render(<HoursProgress summary={mockSummary} />)
    expect(screen.getByText('140h')).toBeInTheDocument()
  })
})
