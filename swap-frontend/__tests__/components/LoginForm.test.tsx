import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/lib/api/auth.api', () => ({
  authApi: {
    login: vi.fn().mockRejectedValue({ message: 'Invalid credentials.', status: 401 }),
  },
}))

vi.mock('@/lib/store/authStore', () => ({
  useAuthStore: () => ({ setAuth: vi.fn() }),
}))

vi.mock('@/lib/utils/roleGuard', () => ({
  getRoleDashboard: () => '/applicant/dashboard',
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

async function renderLoginPage() {
  const { default: LoginPage } = await import('@/app/(auth)/login/page')
  return render(<Wrapper><LoginPage /></Wrapper>)
}

describe('LoginPage', () => {
  it('renders email and password fields', async () => {
    await renderLoginPage()
    expect(screen.getByPlaceholderText(/student@/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/••••/)).toBeInTheDocument()
  })

  it('shows validation error for invalid email', async () => {
    await renderLoginPage()
    const emailInput = screen.getByPlaceholderText(/student@/i)
    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    await userEvent.type(emailInput, 'invalid')
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    })
  })

  it('renders Sign In button', async () => {
    await renderLoginPage()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders forgot password link', async () => {
    await renderLoginPage()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })

  it('renders register link', async () => {
    await renderLoginPage()
    expect(screen.getByText(/register here/i)).toBeInTheDocument()
  })
})
