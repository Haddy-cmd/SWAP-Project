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

  it('rejects an invalid email and does not call the login API', async () => {
    const { authApi } = await import('@/lib/api/auth.api')
    await renderLoginPage()
    const emailInput = screen.getByPlaceholderText(/student@/i)
    const submitBtn = screen.getByRole('button', { name: /sign in/i })

    await userEvent.type(emailInput, 'invalid')
    await userEvent.type(screen.getByPlaceholderText(/••••/), 'Password@123')
    await userEvent.click(submitBtn)

    // Client-side validation (native email + Zod) must block the request.
    await waitFor(() => {
      expect(vi.mocked(authApi.login)).not.toHaveBeenCalled()
    })
  })

  it('shows a Zod validation error when a required field is empty', async () => {
    await renderLoginPage()
    // Valid email passes native validation, so submit reaches Zod, which flags
    // the empty password — proving error messages render.
    await userEvent.type(screen.getByPlaceholderText(/student@/i), 'student@msumarawi.edu.ph')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
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
