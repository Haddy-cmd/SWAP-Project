'use client'

import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api/analytics.api'

export function useAdminOverview(academicYear: string, semester: string) {
  return useQuery({
    queryKey: ['analytics', 'overview', academicYear, semester],
    queryFn: () => analyticsApi.getAdminOverview(academicYear, semester),
    enabled: !!academicYear && !!semester,
    staleTime: 60_000,
  })
}

export function useAuditLogs(page = 1) {
  return useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => analyticsApi.getAuditLogs(page),
  })
}
