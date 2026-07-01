'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  FileText, Users, Banknote, Building2, Table2, Download, Check, ChevronDown,
  CheckCircle2, Eye, Printer, Loader2, Grid3x3, BarChart3,
} from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { useAuthStore } from '@/lib/store/authStore'

type TypeKey = 'applications' | 'recipients' | 'stipend' | 'offices'
type Format = 'PDF' | 'CSV'

const TYPES: { key: TypeKey; name: string; desc: string; Icon: LucideIcon }[] = [
  { key: 'applications', name: 'Applications Summary', desc: 'All submissions with status', Icon: FileText },
  { key: 'recipients', name: 'Recipients & Hours', desc: 'Service hours per recipient', Icon: Users },
  { key: 'stipend', name: 'Stipend Disbursement', desc: 'Payments released per period', Icon: Banknote },
  { key: 'offices', name: 'Office Assignment', desc: 'Recipient-to-office placements', Icon: Building2 },
]
const YEARS = ['2024-2025', '2025-2026', '2026-2027']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const STATUS_STYLE: Record<string, [string, string]> = {
  Approved: ['#2C5A33', '#EAF5EC'], Active: ['#2C5A33', '#EAF5EC'], Released: ['#2C5A33', '#EAF5EC'],
  Submitted: ['#1F5C86', '#EAF1F7'], 'Under Review': ['#9A6B12', '#FDF3E2'], Pending: ['#9A6B12', '#FDF3E2'],
  'Interview Scheduled': ['#5A3E86', '#F1ECF7'], Rejected: ['#A52834', '#FCF2F3'],
}
const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + (i - 26)))
const cellText = (v: string | number | null) => (v === null || v === undefined ? '' : String(v))

export default function AdminReportsPage() {
  const { user } = useAuthStore()
  const [type, setType] = useState<TypeKey>('applications')
  const [year, setYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [format, setFormat] = useState<Format>('PDF')
  const [sheetTab, setSheetTab] = useState<'data' | 'charts'>('data')
  const [toast, setToast] = useState<string | null>(null)

  const { data: preview, isFetching } = useQuery({
    queryKey: ['report-preview', type, year, semester],
    queryFn: () => adminApi.previewReport({ type, academic_year: year, semester }),
    placeholderData: keepPreviousData,
  })

  const headers = preview?.headers ?? []
  const rows = preview?.rows ?? []
  const stats = preview?.stats ?? []
  const statusIdx = headers.indexOf('Status')
  const chart = useMemo(() => computeChart(type, rows, headers), [type, rows, headers])

  const csv = useMutation({
    mutationFn: () => adminApi.generateReport({ type, academic_year: year, semester }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${year}-${semester.replace(/\s+/g, '')}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setToast(`${a.download} downloaded — check your downloads folder.`)
    },
  })

  const download = () => {
    setToast(null)
    if (format === 'PDF') window.print()
    else csv.mutate()
  }

  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Exports</p>
        <h1 className="mt-1 font-serif text-3xl font-medium text-[#241715]">Generate Reports</h1>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[372px_1fr]">
        {/* ── CONFIG PANEL ─────────────────────────────────────────── */}
        <div className="no-print space-y-6 rounded-2xl border border-[#EFE5DA] bg-white p-6 shadow-[0_2px_8px_rgba(60,30,25,.04)]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-[#A38A82]">1 · Report Type</p>
            <div className="space-y-2.5">
              {TYPES.map((t) => {
                const on = type === t.key
                return (
                  <button key={t.key} onClick={() => { setType(t.key); setToast(null) }}
                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors"
                    style={{ border: on ? '1.5px solid #7C1B26' : '1px solid #EADFD4', background: on ? '#FBEAEC' : '#FBF7F2' }}>
                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] text-[#7C1B26]" style={{ background: on ? '#FFFFFF' : '#F4ECE1' }}>
                      <t.Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#241715]">{t.name}</span>
                      <span className="block text-xs text-[#A38A82]">{t.desc}</span>
                    </span>
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2"
                      style={{ borderColor: on ? '#7C1B26' : '#CBB9AC', background: on ? '#7C1B26' : 'transparent' }}>
                      {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-[#A38A82]">2 · Period</p>
            <div className="space-y-3">
              <Dropdown label="Academic Year" value={year} options={YEARS} onChange={(v) => { setYear(v); setToast(null) }} />
              <Dropdown label="Semester" value={semester} options={SEMESTERS} onChange={(v) => { setSemester(v); setToast(null) }} />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-[#A38A82]">3 · Export Format</p>
            <div className="grid grid-cols-2 gap-2.5">
              <FormatCard on={format === 'PDF'} Icon={FileText} name="PDF" desc="Formatted document" onClick={() => { setFormat('PDF'); setToast(null) }} />
              <FormatCard on={format === 'CSV'} Icon={Table2} name="CSV" desc="Opens in Excel" onClick={() => { setFormat('CSV'); setToast(null) }} />
            </div>
          </div>

          <button onClick={download} disabled={csv.isPending || !preview}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,.26)] transition-opacity hover:opacity-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
            {csv.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : format === 'PDF' ? <Printer className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            Download {format}
          </button>

          {toast && (
            <div className="flex items-start gap-2 rounded-xl border border-[#D6EBD8] bg-[#EEF7EF] px-3.5 py-3 text-[12.5px] font-semibold leading-snug text-[#2C5A33]">
              <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] flex-none text-[#4E9657]" /> {toast}
            </div>
          )}
        </div>

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        <div>
          <div className="no-print mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13.5px]">
              <Eye className="h-[18px] w-[18px] text-[#A9823C]" />
              <span className="font-bold text-[#3F2F2A]">Live Preview</span>
              <span className="text-[#A38A82]">· updates with your selections {isFetching && '…'}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold"
              style={format === 'PDF' ? { color: '#A52834', background: '#FBEAEC' } : { color: '#2C7A57', background: '#EAF5EC' }}>
              {format === 'PDF' ? <FileText className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {format}
            </span>
          </div>

          <div className="rounded-2xl border border-[#E0D2C4] bg-[#EBE2D6] p-5 sm:p-6 print:border-0 print:bg-white print:p-0">
            {!preview ? (
              <div className="h-[560px] animate-pulse rounded-lg bg-[#DCCFC0]/60" />
            ) : format === 'PDF' ? (
              /* ---- PDF DOCUMENT ---- */
              <div className="report-doc mx-auto max-w-[820px] rounded-md bg-white p-8 shadow-[0_12px_40px_rgba(40,20,16,.24)] sm:p-11 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
                <div className="flex items-center justify-between border-b-2 border-[#7C1B26] pb-4">
                  <div className="leading-tight">
                    <p className="font-serif text-base font-semibold text-[#241715]">Mindanao State University — Marawi</p>
                    <p className="text-[11.5px] text-[#8A7A73]">Division of Student Affairs · SWAP Portal</p>
                  </div>
                </div>

                <h2 className="mb-1 mt-5 font-serif text-[26px] font-semibold text-[#241715]">{preview.title}</h2>
                <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[#7A6A63]">
                  <span><b className="font-semibold text-[#5A4A45]">Academic Year:</b> {year}</span>
                  <span><b className="font-semibold text-[#5A4A45]">Semester:</b> {semester}</span>
                  <span><b className="font-semibold text-[#5A4A45]">Generated:</b> {genDate}</span>
                  <span><b className="font-semibold text-[#5A4A45]">Prepared by:</b> {user?.name ?? 'Admin'}</span>
                </div>

                <StatGrid stats={stats} />

                <table className="mt-6 w-full border-collapse">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="whitespace-nowrap border-b-2 border-[#E0D2C4] px-2 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[#7A6A63]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 40).map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} className="whitespace-nowrap border-b border-[#F0E6DA] px-2 py-2 text-[11.5px] text-[#3F2F2A]">
                            <StatusOrText value={cellText(c)} isStatus={ci === statusIdx} bold={ci === 0} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-5 flex items-center justify-between border-t border-[#EFE5DA] pt-4 text-[10.5px] text-[#A38A82]">
                  <span>Showing {Math.min(rows.length, 40)} of {rows.length} records.</span>
                  <span>Confidential · For internal use only</span>
                </div>
              </div>
            ) : (
              /* ---- CSV / SPREADSHEET ---- */
              <div className="mx-auto max-w-[900px]">
                <div className="flex items-center gap-2 rounded-t-[10px] border border-[#E0D2C4] bg-white px-4 py-2.5">
                  <Table2 className="h-[18px] w-[18px] text-[#2C7A57]" />
                  <span className="text-[13px] font-semibold text-[#3F2F2A]">{type}-{year}-{semester.replace(/\s+/g, '')}.csv</span>
                  <span className="ml-auto text-[11.5px] text-[#A38A82]">{rows.length + 1} rows × {headers.length} cols</span>
                </div>

                <div className="min-h-[344px] overflow-auto border border-t-0 border-[#E0D2C4] bg-white">
                  {sheetTab === 'data' ? (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="w-[34px] border border-[#E0D2C4] bg-[#F1ECE4] p-1.5" />
                          {headers.map((_, i) => (
                            <th key={i} className="border border-[#E0D2C4] bg-[#F1ECE4] px-2.5 py-1.5 text-center text-[10.5px] font-semibold text-[#8A7A73]">{colLetter(i)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-[#E0D2C4] bg-[#F1ECE4] p-1.5 text-center text-[10.5px] font-semibold text-[#8A7A73]">1</td>
                          {headers.map((h) => (
                            <td key={h} className="whitespace-nowrap border border-[#EADFD4] bg-[#FBF7F2] px-2.5 py-1.5 text-[12px] font-bold text-[#241715]">{h}</td>
                          ))}
                        </tr>
                        {rows.map((r, ri) => (
                          <tr key={ri}>
                            <td className="border border-[#E0D2C4] bg-[#F1ECE4] p-1.5 text-center text-[10.5px] font-semibold text-[#8A7A73]">{ri + 2}</td>
                            {r.map((c, ci) => (
                              <td key={ci} className="whitespace-nowrap border border-[#EADFD4] px-2.5 py-1.5 text-[12px] text-[#3F2F2A]" style={ci === 0 ? { fontWeight: 600 } : undefined}>
                                {cellText(c)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 sm:p-7">
                      <p className="text-[15px] font-bold text-[#241715]">{chart.title}</p>
                      <p className="mb-5 text-[12.5px] text-[#8A7A73]">{chart.sub}</p>
                      <StatGrid stats={stats} compact />
                      <div className="mt-6">
                        {chart.kind === 'bars' ? <BarsChart bars={chart.bars} unit={chart.unit} /> : <DonutChart released={chart.released} pending={chart.pending} total={chart.total} />}
                      </div>
                      <p className="mt-6 text-[11px] text-[#B7A99F]">Chart preview · the CSV download contains the data sheet only.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-b-[10px] border border-t-0 border-[#E0D2C4] bg-[#F1ECE4] px-2 pt-1.5">
                  <SheetTab on={sheetTab === 'data'} Icon={Grid3x3} label="Data" onClick={() => setSheetTab('data')} />
                  <SheetTab on={sheetTab === 'charts'} Icon={BarChart3} label="Charts" onClick={() => setSheetTab('charts')} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print isolation — only the PDF document prints */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-doc, .report-doc * { visibility: visible !important; }
          .report-doc { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────
function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-[#5A4A45]">{label}</label>
      <button onClick={() => setOpen((o) => !o)}
        className="flex h-[46px] w-full items-center justify-between rounded-[11px] border border-[#EADFD4] bg-[#FBF7F2] px-3.5 text-sm font-semibold text-[#2B1E1B]">
        {value} <ChevronDown className="h-[18px] w-[18px] text-[#B79B7E]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[74px] z-30 rounded-xl border border-[#EADFD4] bg-white p-1.5 shadow-[0_18px_40px_rgba(58,24,20,.18)]">
            {options.map((o) => {
              const on = o === value
              return (
                <button key={o} onClick={() => { onChange(o); setOpen(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13.5px] text-[#2B1E1B]"
                  style={{ background: on ? '#FBF3E7' : 'transparent', fontWeight: on ? 700 : 500 }}>
                  {o} {on && <Check className="h-[17px] w-[17px] text-[#7C1B26]" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function FormatCard({ on, Icon, name, desc, onClick }: { on: boolean; Icon: LucideIcon; name: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-center transition-colors"
      style={{ border: on ? '1.5px solid #7C1B26' : '1px solid #EADFD4', background: on ? '#FBEAEC' : '#FBF7F2' }}>
      <Icon className="h-6 w-6" style={{ color: on ? '#7C1B26' : '#B79B7E' }} />
      <span className="text-[13.5px] font-bold text-[#241715]">{name}</span>
      <span className="text-[11px] text-[#A38A82]">{desc}</span>
    </button>
  )
}

function StatGrid({ stats, compact }: { stats: { label: string; value: string }[]; compact?: boolean }) {
  if (!stats.length) return null
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#EFE5DA] bg-[#EFE5DA] sm:grid-cols-4 ${compact ? '' : ''}`}>
      {stats.map((s) => (
        <div key={s.label} className="bg-[#FBF7F2] px-4 py-3">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[#A38A82]">{s.label}</p>
          <p className="font-serif text-[22px] font-semibold text-[#241715]">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function StatusOrText({ value, isStatus, bold }: { value: string; isStatus: boolean; bold: boolean }) {
  const style = isStatus ? STATUS_STYLE[value] : undefined
  if (style) {
    return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: style[0], background: style[1] }}>{value}</span>
  }
  return <span style={bold ? { fontWeight: 600 } : undefined}>{value}</span>
}

function SheetTab({ on, Icon, label, onClick }: { on: boolean; Icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[12.5px]"
      style={{ background: on ? '#fff' : 'transparent', border: on ? '1px solid #E0D2C4' : '1px solid transparent', borderBottom: 'none', color: on ? '#7C1B26' : '#8A7A73', fontWeight: on ? 700 : 500 }}>
      <Icon className="h-[15px] w-[15px]" style={{ color: on ? '#7C1B26' : '#B79B7E' }} /> {label}
    </button>
  )
}

function BarsChart({ bars, unit }: { bars: { label: string; value: number; color: string }[]; unit?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="flex flex-col gap-3">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-3.5">
          <span className="w-[150px] flex-none truncate text-[12.5px] font-semibold text-[#5A4A45]">{b.label}</span>
          <div className="h-[26px] flex-1 overflow-hidden rounded-[7px] bg-[#F4ECE1]">
            <div className="h-full rounded-[7px]" style={{ width: `${(b.value / max) * 100}%`, background: b.color }} />
          </div>
          <span className="w-[52px] flex-none text-right text-[12.5px] font-bold text-[#3F2F2A]">{b.value}{unit ?? ''}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ released, pending, total }: { released: number; pending: number; total: number }) {
  const relPct = total > 0 ? (released / total) * 100 : 0
  return (
    <div className="flex flex-wrap items-center gap-9">
      <div className="flex h-[172px] w-[172px] flex-none items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#4E9657 0 ${relPct}%, #D8A12B ${relPct}% 100%)` }}>
        <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-white">
          <span className="font-serif text-[30px] font-semibold text-[#241715]">{total}</span>
          <span className="text-[10.5px] text-[#A38A82]">recipients</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <LegendRow color="#4E9657" label="Released" value={String(released)} />
        <LegendRow color="#D8A12B" label="Pending" value={String(pending)} />
      </div>
    </div>
  )
}
function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[11px] w-[11px] flex-none rounded-full" style={{ background: color }} />
      <span className="flex-1 text-[13px] font-semibold text-[#3F2F2A]">{label}</span>
      <span className="text-[13px] text-[#8A7A73]">{value}</span>
    </div>
  )
}

// ── chart data from the report rows ───────────────────────────────────────────
type ChartSpec =
  | { kind: 'bars'; title: string; sub: string; bars: { label: string; value: number; color: string }[]; unit?: string; released?: undefined; pending?: undefined; total?: undefined }
  | { kind: 'donut'; title: string; sub: string; released: number; pending: number; total: number; bars?: undefined; unit?: undefined }

function computeChart(type: TypeKey, rows: (string | number | null)[][], headers: string[]): ChartSpec {
  const col = (name: string) => headers.indexOf(name)
  if (type === 'applications') {
    const si = col('Status')
    let approved = 0, rejected = 0, pending = 0
    for (const r of rows) {
      const s = String(r[si] ?? '')
      if (s === 'Approved') approved++
      else if (s === 'Rejected') rejected++
      else pending++
    }
    return {
      kind: 'bars', title: 'Applications by Status', sub: 'Distribution across all applications this period',
      bars: [
        { label: 'Approved', value: approved, color: '#4E9657' },
        { label: 'Pending Review', value: pending, color: '#D8A12B' },
        { label: 'Rejected', value: rejected, color: '#C0562F' },
      ],
    }
  }
  if (type === 'recipients') {
    const vi = col('Verified Hours'); const ni = col('Recipient')
    const bars = rows.slice(0, 8).map((r) => ({ label: String(r[ni] ?? ''), value: Number(r[vi]) || 0, color: '#7C1B26' }))
    return { kind: 'bars', title: 'Service Hours Logged', sub: 'Verified hours per recipient (top 8)', bars, unit: 'h' }
  }
  if (type === 'stipend') {
    const si = col('Status')
    let released = 0, pending = 0
    for (const r of rows) {
      const s = String(r[si] ?? '')
      if (s === 'Released') released++
      else if (s === 'Pending') pending++
    }
    return { kind: 'donut', title: 'Disbursement Status', sub: 'Released vs pending this period', released, pending, total: released + pending }
  }
  const ai = col('Active Recipients'); const oi = col('Office')
  const palette = ['#7C1B26', '#3B7FB5', '#4E9657', '#D8A12B', '#6B4E9A', '#C0562F']
  return {
    kind: 'bars', title: 'Recipients per Office', sub: 'Current placement distribution across host offices',
    bars: rows.map((r, i) => ({ label: String(r[oi] ?? ''), value: Number(r[ai]) || 0, color: palette[i % palette.length] })),
  }
}
