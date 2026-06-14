import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/shared/StatusBadge'

describe('StatusBadge', () => {
  it('renders "Submitted" for submitted status', () => {
    render(<StatusBadge status="submitted" />)
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })

  it('renders "Approved" for approved status', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('renders "Rejected" for rejected status', () => {
    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders "Verified" for verified status', () => {
    render(<StatusBadge status="verified" />)
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('renders "Pending Verification" for pending_verification status', () => {
    render(<StatusBadge status="pending_verification" />)
    expect(screen.getByText('Pending Verification')).toBeInTheDocument()
  })

  it('renders "Open" for open status', () => {
    render(<StatusBadge status="open" />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('applies green style for approved', () => {
    const { container } = render(<StatusBadge status="approved" />)
    expect(container.firstChild).toHaveClass('bg-green-100')
  })

  it('applies red style for rejected', () => {
    const { container } = render(<StatusBadge status="rejected" />)
    expect(container.firstChild).toHaveClass('bg-red-100')
  })
})
