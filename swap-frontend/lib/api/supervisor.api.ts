import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'

export interface OfficeQr {
  office: { id: number; name: string; location: string | null }
  qr_code: string
}

export interface StudentDocument {
  id: number
  document_type: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  application_id: number
  academic_year: string | null
  semester: string | null
  type: 'new' | 'renewal'
}

export const supervisorApi = {
  // The signed attendance QR for the supervisor's assigned office.
  getOfficeQr: () =>
    apiClient.get<ApiResponse<OfficeQr>>('/supervisor/office-qr').then((r) => r.data.data),

  // Application documents of a recipient this supervisor manages.
  getStudentDocuments: (studentId: number) =>
    apiClient.get<ApiResponse<StudentDocument[]>>(`/supervisor/students/${studentId}/documents`).then((r) => r.data.data),
}
