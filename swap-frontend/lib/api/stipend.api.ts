import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { StipendRecord, ClaimVerification, ClaimReleaseResult } from '@/types/analytics.types'

export const stipendApi = {
  // The recipient's own history (claim stubs), shaped by StipendResource. One
  // large page: the page lists and totals every stub (the backend caps at 100;
  // a recipient earns at most a few per year).
  getHistory: () =>
    apiClient
      .get<{ data: StipendRecord[] }>('/recipient/stipend/history', { params: { per_page: 100 } })
      .then((r) => r.data.data),

  // Streams the claim-stub PDF as a Blob so the caller can open/download it.
  // `v` cache-busts the download: the stub re-renders at certification AND when
  // the Banking Office records the payout, so the same URL would otherwise serve
  // the pre-claim bytes.
  getSlip: (id: number, v?: string | null) =>
    apiClient.get<Blob>(`/recipient/stipend/${id}/slip`, { params: v ? { v } : undefined, responseType: 'blob' }).then((r) => r.data),
}

// Banking Office scan-to-confirm (public, token-gated; no login). The token is
// the stub's single-use claim token printed in its QR.
export const claimApi = {
  verify: (token: string) =>
    apiClient.get<{ valid: true; data: ClaimVerification }>(`/stipend/verify/${encodeURIComponent(token)}`).then((r) => r.data.data),

  // Only the PIN: the officer's name on the stub is the one the DSA set with it.
  release: (token: string, data: { pin: string }) =>
    apiClient
      .post<ApiResponse<ClaimReleaseResult>>(`/stipend/verify/${encodeURIComponent(token)}/release`, data)
      .then((r) => r.data),
}
