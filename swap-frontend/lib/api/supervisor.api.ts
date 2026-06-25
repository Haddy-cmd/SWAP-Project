import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'

export interface OfficeQr {
  office: { id: number; name: string; location: string | null }
  qr_code: string
}

export const supervisorApi = {
  // The signed attendance QR for the supervisor's assigned office.
  getOfficeQr: () =>
    apiClient.get<ApiResponse<OfficeQr>>('/supervisor/office-qr').then((r) => r.data.data),
}
