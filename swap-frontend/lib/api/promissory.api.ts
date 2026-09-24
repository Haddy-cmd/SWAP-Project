import apiClient from './axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { PromissoryNote, PromissorySubmission } from '@/types/promissory.types'

export const promissoryApi = {
  // The student's own notes + whether a new one can be submitted right now.
  getMine: () =>
    apiClient.get<{ data: { notes: PromissoryNote[]; submission: PromissorySubmission } }>('/recipient/promissory').then((r) => r.data.data),

  submit: (assignmentId: number, reason: string, file: File) => {
    const fd = new FormData()
    fd.append('assignment_id', String(assignmentId))
    fd.append('reason', reason)
    fd.append('file', file)
    return apiClient.post<ApiResponse<PromissoryNote>>('/recipient/promissory', fd).then((r) => r.data.data)
  },

  // Streams the promissory document as a Blob (same pattern as the claim slip).
  downloadFile: (id: number, fileName: string) =>
    downloadBlob(`/recipient/promissory/${id}/file`, fileName),

  // Supervisor queue over their governed students (?status=pending|approved|rejected).
  getSupervisorQueue: (status?: string) =>
    apiClient.get<PaginatedResponse<PromissoryNote>>('/supervisor/promissory', { params: status ? { status } : undefined }).then((r) => r.data),

  review: (id: number, data: { action: 'approve' | 'reject'; lacking_hours?: number; review_remarks?: string }) =>
    apiClient.post<ApiResponse<PromissoryNote>>(`/supervisor/promissory/${id}/review`, data).then((r) => r.data.data),

  // Streams a governed student's promissory document as a Blob.
  downloadSupervisorFile: (id: number, fileName: string) =>
    downloadBlob(`/supervisor/promissory/${id}/file`, fileName),

  // DSA visibility over everything supervisors decided.
  getAdminList: (status?: string) =>
    apiClient.get<PaginatedResponse<PromissoryNote>>('/admin/promissory', { params: status ? { status } : undefined }).then((r) => r.data),

  downloadAdminFile: (id: number, fileName: string) =>
    downloadBlob(`/admin/promissory/${id}/file`, fileName),
}

function downloadBlob(path: string, fileName: string) {
  return apiClient.get<Blob>(path, { responseType: 'blob' }).then((r) => {
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  })
}
