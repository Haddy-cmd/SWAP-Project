import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/lib/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, name: 'Test User', role: 'admin' } }),
}))

vi.mock('@/lib/api/analytics.api', () => ({
  analyticsApi: {
    getAdminOverview: vi.fn().mockResolvedValue({
      total_applications: 5, active_recipients: 3, pending_applications: 2, total_offices: 4,
      office_distribution: [], monthly_stats: [], stipend_summary: { total_released: 0, total_pending: 0 },
    }),
  },
}))

vi.mock('@/lib/api/attendance.api', () => ({
  attendanceApi: {
    getHoursSummary: vi.fn().mockResolvedValue({
      required: 240, rendered: 0, verified: 0, pending: 0, rejected: 0, remaining: 240,
    }),
    getSupervisorStudents: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

vi.mock('@/lib/api/applications.api', () => ({
  applicationsApi: { getMyApplications: vi.fn().mockResolvedValue([]) },
}))

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('dashboard pages render without crashing', () => {
  it('admin dashboard', async () => {
    const { default: Page } = await import('@/app/(dashboard)/admin/dashboard/page')
    renderWithQuery(<Page />)
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument()
  })

  it('recipient dashboard', async () => {
    const { default: Page } = await import('@/app/(dashboard)/recipient/dashboard/page')
    renderWithQuery(<Page />)
    expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument()
  })

  it('applicant dashboard', async () => {
    const { default: Page } = await import('@/app/(dashboard)/applicant/dashboard/page')
    renderWithQuery(<Page />)
    expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument()
  })

  it('supervisor dashboard', async () => {
    const { default: Page } = await import('@/app/(dashboard)/supervisor/dashboard/page')
    renderWithQuery(<Page />)
    expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument()
  })
})
