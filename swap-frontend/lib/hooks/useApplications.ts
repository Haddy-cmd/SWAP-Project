'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/lib/api/applications.api'
import type { DecideApplicationData, ScheduleInterviewData, StoreApplicationData } from '@/types/application.types'

export function useMyApplications() {
  return useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })
}

export function useApplication(id: number) {
  return useQuery({
    queryKey: ['applications', id],
    queryFn: () => applicationsApi.getApplication(id),
    enabled: !!id,
  })
}

export function useSubmitApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StoreApplicationData) => applicationsApi.submitApplication(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}

export function useAdminApplications(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'applications', filters],
    queryFn: () => applicationsApi.adminListApplications(filters),
  })
}

export function useAdminApplication(id: number) {
  return useQuery({
    queryKey: ['admin', 'applications', id],
    queryFn: () => applicationsApi.adminGetApplication(id),
    enabled: !!id,
  })
}

export function useDecideApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DecideApplicationData }) =>
      applicationsApi.adminDecideApplication(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'applications'] })
    },
  })
}

export function useScheduleInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScheduleInterviewData }) =>
      applicationsApi.adminScheduleInterview(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'applications'] })
    },
  })
}
