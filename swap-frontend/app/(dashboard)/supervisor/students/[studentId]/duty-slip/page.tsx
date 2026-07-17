'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance.api'
import {
  DutySlipControls, DutySlipDocument, mondayOf, iso,
  type DutySlipMode, type DutySlipIdentity,
} from '@/components/attendance/DutySlip'
import type { TimeLog } from '@/types/attendance.types'

export default function SupervisorDutySlipPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [mode, setMode] = useState<DutySlipMode>('week')
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())))

  const { data: summary } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: () => attendanceApi.getStudentSummary(Number(studentId)),
    enabled: !!studentId,
  })

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['student-logs', studentId, 'duty-slip'],
    queryFn: () => attendanceApi.getStudentLogs(Number(studentId), { per_page: '100' }),
    enabled: !!studentId,
  })
  const logs: TimeLog[] = logsData?.data ?? []

  const s = summary?.student
  const identity: DutySlipIdentity = {
    name: s?.name ?? '',
    courseYear: s ? `${s.program ?? ''}${s.year_level ? ` - ${s.year_level}` : ''}` : '',
    office: s?.office ?? '',
    supervisor: s?.supervisor ?? '',
    studentIdNumber: s?.student_id_number,
    academicYear: s?.academic_year,
    semester: s?.semester,
  }

  return (
    <div className="space-y-5">
      <Link href={`/supervisor/students/${studentId}`}
        className="no-print flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#8A7A73] hover:text-[#7C1B26] transition-colors">
        <ArrowLeft className="h-[19px] w-[19px]" /> Back to {s?.name ?? 'student'}
      </Link>
      <DutySlipControls
        title={s?.name ? `${s.name} — Duty Slip` : 'Duty Slip'}
        subtitle="Auto-filled from this student's verified attendance. Choose a range, then print or save as PDF."
        mode={mode} setMode={setMode} weekStart={weekStart} setWeekStart={setWeekStart}
      />
      {isLoading && <div className="no-print h-40 animate-pulse rounded-2xl bg-[#E2E8F0]" />}
      <DutySlipDocument mode={mode} weekStart={weekStart} logs={logs} identity={identity} />
    </div>
  )
}
