import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'

// Axios keeps registered interceptors on an internal `handlers` array that isn't part of its
// public types. These typed accessors expose just what the tests need without resorting to `any`.
interface TestConfig {
  headers: Record<string, string | undefined>
}
interface RequestHandlerEntry {
  fulfilled: (config: TestConfig) => TestConfig
}
interface ResponseHandlerEntry {
  rejected: (error: unknown) => Promise<unknown>
}

function requestFulfilled(api: AxiosInstance): (config: TestConfig) => TestConfig {
  return (api.interceptors.request as unknown as { handlers: RequestHandlerEntry[] }).handlers[0].fulfilled
}

function responseRejected(api: AxiosInstance): (error: unknown) => Promise<unknown> {
  return (api.interceptors.response as unknown as { handlers: ResponseHandlerEntry[] }).handlers[0].rejected
}

const logout = vi.fn()
let currentToken: string | null = null

vi.mock('@/lib/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ token: currentToken, logout }),
  },
}))

// jsdom cannot navigate; stub the location assignment used on 401.
beforeEach(() => {
  vi.clearAllMocks()
  currentToken = null
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  })
})

async function client() {
  const mod = await import('@/lib/api/axios')
  return mod.default
}

describe('axios request interceptor', () => {
  it('attaches the Bearer token when present', async () => {
    currentToken = 'abc123'
    const api = await client()
    const onFulfilled = requestFulfilled(api)
    const config = onFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('does not attach Authorization when there is no token', async () => {
    currentToken = null
    const api = await client()
    const onFulfilled = requestFulfilled(api)
    const config = onFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('axios response interceptor', () => {
  async function rejectHandler() {
    const api = await client()
    return responseRejected(api)
  }

  it('on 401 logs the user out and rejects with a session message', async () => {
    const onRejected = await rejectHandler()
    await expect(onRejected({ response: { status: 401 } })).rejects.toThrow(/session expired/i)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('on 422 rejects with the field errors attached', async () => {
    const onRejected = await rejectHandler()
    await expect(
      onRejected({ response: { status: 422, data: { errors: { email: ['Invalid'] } } } })
    ).rejects.toMatchObject({ status: 422, errors: { email: ['Invalid'] } })
  })

  it('on 500 rejects with a generic server error', async () => {
    const onRejected = await rejectHandler()
    await expect(onRejected({ response: { status: 500 } })).rejects.toThrow(/server error/i)
  })
})
