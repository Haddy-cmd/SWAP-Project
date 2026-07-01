'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileDown, Loader2 } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'

const YEARS = ['2024-2025', '2025-2026', '2026-2027']
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
  const [downloaded, setDownloaded] = useState(false)

  const generate = useMutation({
    mutationFn: () =>
      adminApi.generateReport({ type, academic_year: year, semester }),
    onSuccess: (blob) => {
      // Trigger a client-side download of the returned CSV blob.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${year}-${semester.replace(/\s+/g, '')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDownloaded(true)
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
          onClick={() => { setDownloaded(false); generate.mutate() }}
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

        {downloaded && !generate.isPending && (
          <div className="flex items-center gap-3 rounded-xl border border-[#27AE60] bg-green-50 px-4 py-3">
            <FileDown className="h-5 w-5 text-[#27AE60]" />
            <p className="text-sm font-medium text-[#27AE60]">Report downloaded — check your downloads folder.</p>
          </div>
        )}

        {generate.isError && (
          <p className="text-sm text-[#E74C3C]">Failed to generate report. Please try again.</p>
        )}
      </div>
    </div>
  )
}
