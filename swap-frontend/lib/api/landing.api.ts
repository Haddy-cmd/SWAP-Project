import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'
import type { LandingPhoto } from '@/types/landing.types'

/** Admin → Landing Page: the carousel photos. */
export const landingApi = {
  list: () =>
    apiClient
      .get<{ data: LandingPhoto[]; meta: { max_photos: number } }>('/admin/landing/photos')
      .then((r) => r.data),

  upload: (photo: File, caption: string) => {
    const fd = new FormData()
    fd.append('photo', photo)
    fd.append('caption', caption)
    return apiClient
      .post<ApiResponse<LandingPhoto>>('/admin/landing/photos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },

  update: (id: number, data: { caption?: string; is_active?: boolean }) =>
    apiClient.put<ApiResponse<LandingPhoto>>(`/admin/landing/photos/${id}`, data).then((r) => r.data),

  reorder: (ids: number[]) =>
    apiClient.put<{ data: LandingPhoto[]; message: string }>('/admin/landing/photos/order', { ids }).then((r) => r.data),

  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/admin/landing/photos/${id}`).then((r) => r.data),
}
