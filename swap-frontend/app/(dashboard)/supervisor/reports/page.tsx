'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Download, Printer, FileSpreadsheet, Loader2, CheckCircle2, Users } from 'lucide-react'
import { supervisorApi } from '@/lib/api/supervisor.api'
import { useAuthStore } from '@/lib/store/authStore'

/** Colour the Pace column so a scan of the sheet shows who needs attention. */
const PACE_CELL: Record<string, { color: string; bg: string }> = {
  'Behind': { color: '#B45309', bg: '#FDF8E4' },
  'On Track': { color: '#145643', bg: '#EFF8F4' },
  'Complete': { color: '#145643', bg: '#EFF8F4' },
  'Not Started': { color: '#6F7B74', bg: '#ECEFE2' },
}

const PACE_COL = 11

export default function SupervisorReportsPage() {
  const { user } = useAuthStore()
  const [toast, setToast] = useState<string | null>(null)
  const genDate = format(new Date(), 'MMMM d, yyyy')

  const { data: report, isLoading } = useQuery({
    queryKey: ['supervisor-roster-summary'],
    queryFn: () => supervisorApi.getRosterSummary(),
  })

  const csv = useMutation({
    mutationFn: () => supervisorApi.exportRosterCsv(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `service-hours-summary-${format(new Date(), 'yyyyMMdd')}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setToast(`${a.download} downloaded — check your downloads folder.`)
    },
    onError: () => setToast('Could not generate the CSV. Please try again.'),
  })

  const rows = report?.rows ?? []
  const stats = report?.stats ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">End of Semester</p>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">Service Hours Summary</h1>
          <p className="mt-1 text-sm text-ink-500">
            Every recipient under your supervision, with verified, pending and remaining hours — ready to hand to the DSA.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => window.print()}
            disabled={isLoading || !rows.length}
            className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={() => { setToast(null); csv.mutate() }}
            disabled={csv.isPending || isLoading || !rows.length}
            className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50 transition-colors"
          >
            {csv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download CSV
          </button>
        </div>
      </div>

      {toast && (
        <div className="no-print flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {toast}
        </div>
      )}

      {isLoading ? (
        <div className="h-[520px] animate-pulse rounded-2xl bg-ink-200" />
      ) : !rows.length ? (
        <div className="no-print flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300 py-16 text-center">
          <Users className="h-10 w-10 text-ink-300" />
          <p className="text-sm font-medium text-ink-350">No students assigned yet — nothing to summarise.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-300 bg-ink-100 p-5 sm:p-6 print:border-0 print:bg-white print:p-0">
          {/* The document — this is the only thing that prints */}
          <div className="report-doc mx-auto max-w-[1000px] rounded-md bg-white p-8 shadow-[0_12px_40px_rgba(19,36,26,.24)] sm:p-11 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
            <div className="flex items-center justify-between border-b-2 border-brand-700 pb-4">
              <div className="leading-tight">
                <p className="font-serif text-base font-semibold text-ink-950">Mindanao State University — Marawi</p>
                <p className="text-[11.5px] text-ink-500">Division of Student Affairs · SWAP Portal</p>
              </div>
              <FileSpreadsheet className="h-7 w-7 text-gold-600 print:hidden" />
            </div>

            <h2 className="mb-1 mt-5 font-serif text-[26px] font-semibold text-ink-950">{report?.title}</h2>
            <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-500">
              <span><b className="font-semibold text-ink-600">Office:</b> {report?.office}</span>
              <span><b className="font-semibold text-ink-600">Supervisor:</b> {report?.supervisor ?? user?.name}</span>
              <span><b className="font-semibold text-ink-600">Generated:</b> {genDate}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-[11px] border border-ink-200 bg-ink-50 px-4 py-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{s.label}</div>
                  <div className="mt-1 font-serif text-[22px] font-semibold leading-none tabular-nums text-ink-950">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {(report?.headers ?? []).map((h, i) => (
                      <th key={h}
                        className={`whitespace-nowrap border-b-2 border-ink-300 px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-500 ${i >= 6 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => {
                        const pace = ci === PACE_COL ? PACE_CELL[String(c)] : undefined
                        return (
                          <td key={ci}
                            className={`whitespace-nowrap border-b border-ink-100 px-2 py-2 text-[11.5px] text-ink-700 ${ci >= 6 ? 'text-right tabular-nums' : 'text-left'} ${ci === 0 ? 'font-semibold' : ''}`}>
                            {pace ? (
                              <span className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                                style={{ color: pace.color, background: pace.bg }}>
                                {String(c)}
                              </span>
                            ) : (c ?? '—')}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-ink-200 pt-4 text-[10.5px] text-ink-400">
              <span>{rows.length} recipient{rows.length === 1 ? '' : 's'}.</span>
              <span>Confidential · For internal use only</span>
            </div>

            {/* Signature block — this sheet gets signed and filed */}
            <div className="mt-10 hidden justify-between gap-12 print:flex">
              {['Prepared by (Supervisor)', 'Noted by (DSA)'].map((label) => (
                <div key={label} className="flex-1">
                  <div className="h-10 border-b border-ink-950" />
                  <p className="mt-1 text-[10.5px] text-ink-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Print isolation — only the document prints */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-doc, .report-doc * { visibility: visible !important; }
          .report-doc { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>
    </div>
  )
}
