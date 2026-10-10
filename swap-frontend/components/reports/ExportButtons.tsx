'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, Loader2, Table2 } from 'lucide-react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { saveBlob } from '@/lib/utils/download'

interface Props {
  /** Fetches the file; the server re-applies the same filters, so it matches the screen. */
  download: (format: 'pdf' | 'csv', options: { includeChart: boolean }) => Promise<{ blob: Blob; filename: string | null }>
  fallbackName: string
  disabled?: boolean
  /** Shown in the success message, e.g. "12 of 40 records". */
  summary?: string
  /** Which files to offer; the Overview has no table, so it offers the PDF only. */
  formats?: ('pdf' | 'csv')[]
  /** The PDF prints a graph: offer "Include graph" (on by default) next to the button. */
  chartOption?: boolean
  /** The PDF button's text (default "Download PDF"). */
  label?: string
}

export function ExportButtons({ download, fallbackName, disabled, summary, formats = ['pdf', 'csv'], chartOption = false, label = 'Download PDF' }: Props) {
  const { notify, notifyError } = useFeedback()
  const [includeChart, setIncludeChart] = useState(true)
  const withChart = !chartOption || includeChart

  const run = useMutation({
    mutationFn: (format: 'pdf' | 'csv') => download(format, { includeChart: withChart }).then((r) => ({ ...r, format })),
    onSuccess: ({ blob, filename, format }) => {
      const name = filename ?? `${fallbackName}.${format}`
      saveBlob(blob, name)
      const note = format === 'pdf' && chartOption && !withChart ? ' (without the graph)' : ''
      notify({ title: `${format.toUpperCase()} downloaded`, detail: `${name}${note}${summary ? ` · ${summary}` : ''} — check your downloads folder.` })
    },
    onError: (e) => notifyError(e, 'Could not generate the file'),
  })
  const busy = run.isPending ? run.variables : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chartOption && formats.includes('pdf') && (
        <label className="flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-[10px] border border-ink-200 bg-white px-2.5 text-[12.5px] font-medium text-ink-600"
          title="Print the graph in the PDF (the KPIs and the table are always included)">
          <input type="checkbox" checked={includeChart} onChange={(e) => setIncludeChart(e.target.checked)}
            disabled={disabled || run.isPending} className="h-3.5 w-3.5 accent-brand-700" />
          Include graph
        </label>
      )}
      {formats.includes('pdf') && <button onClick={() => run.mutate('pdf')} disabled={disabled || run.isPending}
        className="flex h-9 items-center gap-2 rounded-[10px] bg-brand-700 px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(22,69,43,.2)] hover:bg-brand-800 disabled:opacity-50">
        {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {label}
      </button>}
      {formats.includes('csv') && <button onClick={() => run.mutate('csv')} disabled={disabled || run.isPending}
        className="flex h-9 items-center gap-2 rounded-[10px] border border-ink-200 bg-white px-3.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
        {busy === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />} CSV
      </button>}
    </div>
  )
}
