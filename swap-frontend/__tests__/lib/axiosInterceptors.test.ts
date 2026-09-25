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

  it('on 422 keeps the server message and the raw response', async () => {
    const onRejected = await rejectHandler()
    const response = { status: 422, data: { message: 'Set your position title first.', errors: {} } }
    await expect(onRejected({ response })).rejects.toMatchObject({
      message: 'Set your position title first.',
      status: 422,
      response,
    })
  })

  it.each([
    [403, 'Your account has been deactivated. Please contact the DSA Office.'],
    [409, 'You are already clocked in. Please clock out before clocking in again.'],
    [429, 'Too Many Attempts.'],
  ])('on %i rejects with the backend message verbatim', async (status, message) => {
    const onRejected = await rejectHandler()
    const response = { status, data: { message } }
    const err = (await onRejected({ response }).catch((e: unknown) => e)) as Error & { status: number; response: unknown }

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(message)
    expect(err.status).toBe(status)
    // Callers that still read err.response.data.message see the same text.
    expect(err.response).toBe(response)
  })

  it('passes a blob error (file download) through untouched', async () => {
    const onRejected = await rejectHandler()
    const original = { response: { status: 503, data: new Blob(['{"message":"x"}']) } }
    await expect(onRejected(original)).rejects.toBe(original)
  })
})
