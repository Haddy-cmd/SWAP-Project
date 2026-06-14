'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileDown, Loader2 } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'

const YEARS = ['2024-2025', '2025-2026']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']
const REPORT_TYPES = [
  { value: 'applications', label: 'Applications Summary' },
  { value: 'recipients', label: 'Recipients & Hours' },
  { value: 'stipend', label: 'Stipend Disbursement' },
  { value: 'offices', label: 'Office Assignment' },
]

export default function AdminReportsPage() {
  const [year, setYear] = useState('2024-2025')
  const [semester, setSemester] = useState('1st Semester')
  const [type, setType] = useState('applications')
  const [generated, setGenerated] = useState<string | null>(null)

  const generate = useMutation({
    mutationFn: () =>
      adminApi.generateReport({ type, academic_year: year, semester }),
    onSuccess: (res) => {
      const url = (res as { data?: { url?: string } })?.data?.url ?? null
      setGenerated(url)
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Generate Reports</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Export PDF or Excel reports for any semester.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Report Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-sm focus:border-[#1B4F72] focus:outline-none"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Academic Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-sm focus:border-[#1B4F72] focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-sm focus:border-[#1B4F72] focus:outline-none"
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => { setGenerated(null); generate.mutate() }}
          disabled={generate.isPending}
          className="flex items-center gap-2 rounded-xl bg-[#1B4F72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2980B9] disabled:opacity-60 transition-colors"
        >
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {generate.isPending ? 'Generating…' : 'Generate Report'}
        </button>

        {generated && (
          <div className="flex items-center gap-3 rounded-xl border border-[#27AE60] bg-green-50 px-4 py-3">
            <FileDown className="h-5 w-5 text-[#27AE60]" />
            <p className="text-sm font-medium text-[#27AE60]">Report ready.</p>
            <a
              href={generated}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto rounded-lg bg-[#27AE60] px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Download
            </a>
          </div>
        )}

        {generate.isError && (
          <p className="text-sm text-[#E74C3C]">Failed to generate report. Please try again.</p>
        )}
      </div>
    </div>
  )
}
