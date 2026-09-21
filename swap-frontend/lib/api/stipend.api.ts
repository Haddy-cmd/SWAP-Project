import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { StipendRecord } from '@/types/analytics.types'

export const stipendApi = {
  // The recipient's own history (claim stubs), shaped by StipendResource.
  getHistory: () =>
    apiClient.get<{ data: StipendRecord[] }>('/recipient/stipend/history').then((r) => r.data.data),

  // Streams the claim-stub PDF as a Blob so the caller can open/download it.
  getSlip: (id: number) =>
    apiClient.get<Blob>(`/recipient/stipend/${id}/slip`, { responseType: 'blob' }).then((r) => r.data),

  // Beneficiary confirms receipt at the Banking Office (password = step-up re-auth).
  confirmReceipt: (id: number, data: { password: string; releasing_officer_name: string; remarks?: string }) =>
    apiClient.post<ApiResponse<StipendRecord>>(`/recipient/stipend/${id}/confirm-receipt`, data).then((r) => r.data.data),
}
