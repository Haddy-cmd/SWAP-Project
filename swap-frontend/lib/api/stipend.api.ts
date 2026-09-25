import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { StipendRecord } from '@/types/analytics.types'

export const stipendApi = {
  // The recipient's own history (claim stubs), shaped by StipendResource. One
  // large page: the page lists and totals every stub (the backend caps at 100;
  // a recipient earns at most a few per year).
  getHistory: () =>
    apiClient
      .get<{ data: StipendRecord[] }>('/recipient/stipend/history', { params: { per_page: 100 } })
      .then((r) => r.data.data),

  // Streams the claim-stub PDF as a Blob so the caller can open/download it.
  // `v` cache-busts the download: the stub re-renders at certification AND at
  // receipt, so the same URL would otherwise serve the pre-confirm bytes.
  getSlip: (id: number, v?: string | null) =>
    apiClient.get<Blob>(`/recipient/stipend/${id}/slip`, { params: v ? { v } : undefined, responseType: 'blob' }).then((r) => r.data),

  // Beneficiary confirms receipt at the Banking Office. No step-up password:
  // the logged-in session is the signature (releasing-officer name required).
  confirmReceipt: (id: number, data: { releasing_officer_name: string; remarks?: string }) =>
    apiClient.post<ApiResponse<StipendRecord>>(`/recipient/stipend/${id}/confirm-receipt`, data).then((r) => r.data.data),
}
