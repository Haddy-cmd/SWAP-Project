import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/supervisor/verifications',
}))

vi.mock('@/lib/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 9, name: 'Supervisor', role: 'supervisor' }, token: 't' }),
}))

const log = (id: number, name: string, hours: number) => ({
  id, user_id: id, date: '2026-10-01', time_in: '2026-10-01T00:00:00.000Z', time_out: '2026-10-01T04:00:00.000Z',
  duration_hours: hours, status: 'pending_verification', is_manual: false, location_flagged: false,
  time_in_photo_url: '/selfie.jpg', user: { id, name },
})

const verifyLogsBulk = vi.fn()
vi.mock('@/lib/api/attendance.api', () => ({
  attendanceApi: {
    getPendingVerifications: vi.fn(async () => [log(1, 'Amina Roster', 4), log(2, 'Ben Logs', 3)]),
    getReviewedVerifications: vi.fn(async () => []),
    verifyLogsBulk: (ids: number[]) => verifyLogsBulk(ids),
  },
}))

async function renderPage() {
  const { default: Page } = await import('@/app/(dashboard)/supervisor/verifications/page')
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><FeedbackProvider><Page /></FeedbackProvider></QueryClientProvider>)
  await screen.findByText('Amina Roster')
  fireEvent.click(screen.getByTitle(/select all/i))
}

beforeEach(() => {
  verifyLogsBulk.mockReset()
  verifyLogsBulk.mockResolvedValue({ message: '2 logs verified.', meta: { verified: 2, skipped: 0 } })
})

describe('Verifications: verify selected', () => {
  it('asks first, and does nothing on Cancel', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /verify selected/i }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Verify 2 logs?')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('7.00 hours will be credited')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(verifyLogsBulk).not.toHaveBeenCalled()
  })

  it('verifies on confirm and pops out the result', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /verify selected/i }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify all' })) })

    expect(verifyLogsBulk).toHaveBeenCalledWith([1, 2])
    expect(await screen.findByRole('status')).toHaveTextContent('2 logs verified')
  })
})
