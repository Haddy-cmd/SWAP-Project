import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import apiClient from '@/lib/api/axios'

/** Captures the request instead of sending it. */
const capture = async (data: unknown) => {
  let seen: InternalAxiosRequestConfig | undefined
  await apiClient.post('/anything', data, {
    adapter: async (config) => {
      seen = config
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    },
  })
  return seen!
}

describe('apiClient', () => {
  it('sends uploads as multipart, keeping the file (not as JSON)', async () => {
    const fd = new FormData()
    fd.append('assignment_id', '7')
    fd.append('file', new File(['%PDF-1.4'], 'note.pdf', { type: 'application/pdf' }))

    const config = await capture(fd)

    expect(config.data).toBeInstanceOf(FormData)
    expect((config.data as FormData).get('file')).toBeInstanceOf(File)
    expect(String(config.headers.getContentType() ?? '')).not.toContain('application/json')
  })

  it('still sends plain objects as JSON', async () => {
    const config = await capture({ hello: 'world' })

    expect(config.data).toBe('{"hello":"world"}')
    expect(String(config.headers.getContentType())).toContain('application/json')
  })
})
