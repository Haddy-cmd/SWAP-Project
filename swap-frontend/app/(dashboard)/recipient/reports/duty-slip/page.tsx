'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance.api'
import { useAuthStore } from '@/lib/store/authStore'
import {
  DutySlipControls, DutySlipDocument, mondayOf, iso,
  type DutySlipMode, type DutySlipIdentity,
} from '@/components/attendance/DutySlip'
import type { TimeLog } from '@/types/attendance.types'

export default function DutySlipPage() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<DutySlipMode>('week')
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())))

  const { data: assignment } = useQuery({
    queryKey: ['my-assignment'],
    queryFn: () => attendanceApi.getMyAssignment(),
  })

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['my-logs', 'duty-slip'],
    queryFn: () => attendanceApi.getMyLogs({ per_page: '100' }),
  })
  const logs: TimeLog[] = logsData?.data ?? []

  const profile = user?.profile
  const identity: DutySlipIdentity = {
    name: profile?.full_name || user?.name || '',
    courseYear: profile ? `${profile.program ?? ''}${profile.year_level ? ` - ${profile.year_level}` : ''}` : '',
    office: assignment?.office?.name ?? '',
    supervisor: assignment?.supervisor?.name ?? '',
    studentIdNumber: profile?.student_id_number,
    academicYear: assignment?.academic_year,
    semester: assignment?.semester,
  }

  return (
    <div className="space-y-5">
      <DutySlipControls
        title="Weekly Duty Slip"
        subtitle="Auto-filled from your attendance. Choose a range, then print or save as PDF to submit."
        mode={mode} setMode={setMode} weekStart={weekStart} setWeekStart={setWeekStart}
      />
      {isLoading && <div className="no-print h-40 animate-pulse rounded-2xl bg-[#E2E8F0]" />}
      <DutySlipDocument mode={mode} weekStart={weekStart} logs={logs} identity={identity} />
    </div>
  )
}
