'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import type { StoreNarrativeData, VerifyLogData } from '@/types/attendance.types'

export function useTimeOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, qrToken }: { logId: number; qrToken: string }) =>
      attendanceApi.timeOut(logId, qrToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hours'] })
      qc.invalidateQueries({ queryKey: ['timelogs'] })
    },
  })
}

export function useSubmitNarrative() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, data }: { logId: number; data: StoreNarrativeData }) =>
      attendanceApi.submitNarrative(logId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timelogs'] })
    },
  })
}

export function useVerifyLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, data }: { logId: number; data: VerifyLogData }) =>
      attendanceApi.verifyLog(logId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'logs'] })
    },
  })
}

export function useSupervisorStudents() {
  return useQuery({
    queryKey: ['supervisor', 'students'],
    queryFn: () => attendanceApi.getSupervisorStudents(),
  })
}

export function useStudentLogs(studentId: number, params?: Record<string, string>) {
  return useQuery({
    queryKey: ['supervisor', 'logs', studentId, params],
    queryFn: () => attendanceApi.getStudentLogs(studentId, params),
    enabled: !!studentId,
  })
}
