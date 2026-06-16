import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    const onFulfilled = api.interceptors.request.handlers[0].fulfilled
    const config = onFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('does not attach Authorization when there is no token', async () => {
    currentToken = null
    const api = await client()
    const onFulfilled = api.interceptors.request.handlers[0].fulfilled
    const config = onFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('axios response interceptor', () => {
  async function rejectHandler() {
    const api = await client()
    return api.interceptors.response.handlers[0].rejected
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
