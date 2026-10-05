import apiClient from './axios'
import type { StipendRecord } from '@/types/analytics.types'

export const stipendApi = {
  // The recipient's own history (claim stubs), shaped by StipendResource. One
  // large page: the page lists and totals every stub (the backend caps at 100;
  // a recipient earns at most a few per year).
  getHistory: () =>
    apiClient
      .get<{ data: StipendRecord[] }>('/recipient/stipend/history', { params: { per_page: 100 } })
      .then((r) => r.data.data),

  // Streams the stub PDF as a Blob so the caller can open/download it. `v`
  // cache-busts the download: a void re-renders the stub, so the same URL would
  // otherwise serve the old bytes.
  getSlip: (id: number, v?: string | null) =>
    apiClient.get<Blob>(`/recipient/stipend/${id}/slip`, { params: v ? { v } : undefined, responseType: 'blob' }).then((r) => r.data),
}
