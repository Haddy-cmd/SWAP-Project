import apiClient from './axios'
import type { CurrentSemester, SemesterPeriod, SemesterPeriodInput } from '@/types/semester.types'

// Admin → Semesters: the DSA calendar every term-date rule reads from.
export const semestersApi = {
  // Newest first.
  list: () =>
    apiClient.get<{ data: SemesterPeriod[] }>('/admin/semester-periods').then((r) => r.data.data),

  // Dashboard card: the current term (else the next one) and the renewal term.
  current: () =>
    apiClient.get<{ data: CurrentSemester }>('/admin/semester-periods/current').then((r) => r.data.data),

  create: (data: SemesterPeriodInput) =>
    apiClient.post<{ data: SemesterPeriod; message: string }>('/admin/semester-periods', data).then((r) => r.data),

  update: (id: number, data: SemesterPeriodInput) =>
    apiClient.put<{ data: SemesterPeriod; message: string }>(`/admin/semester-periods/${id}`, data).then((r) => r.data),

  // Refused (422) once assignments or applications use the term.
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/admin/semester-periods/${id}`).then((r) => r.data),
}
