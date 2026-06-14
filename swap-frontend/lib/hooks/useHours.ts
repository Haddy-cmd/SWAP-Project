'use client'

import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'

export function useHoursSummary() {
  return useQuery({
    queryKey: ['hours', 'summary'],
    queryFn: () => attendanceApi.getHoursSummary(),
    staleTime: 30_000,
  })
}
