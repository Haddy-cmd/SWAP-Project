'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, X, Users, Copy, Check, Search, Trash2, User as UserIcon, CheckCircle2, Circle, Construction,
  PauseCircle, QrCode, ChevronDown, ArrowRight, Plus, Minus, UserCog, Printer,
} from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { adminApi } from '@/lib/api/admin.api'
import { QrDisplay } from '@/components/attendance/QrDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatHours } from '@/lib/utils/formatHours'
import type { Office } from '@/types/assignment.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { copyText } from '@/lib/utils/clipboard'

const OfficeMapPicker = dynamic(() => import('@/components/admin/OfficeMapPicker'), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-xl bg-ink-200" />,
})

// Soft icon backgrounds, mirrored from the mockup (bg / fg pairs).
const PALETTE: [string, string][] = [
  ['var(--color-info-50)', 'var(--color-info-800)'],
  ['var(--color-gold-50)', 'var(--color-gold-600)'],
  ['var(--color-success-50)', 'var(--color-success-600)'],
  ['var(--color-violet-100)', 'var(--color-violet-600)'],
  ['var(--color-info-50)', 'var(--color-info-500)'],
  ['var(--color-brand-100)', 'var(--color-brand-700)'],
  ['var(--color-danger-50)', 'var(--color-danger-500)'],
  ['var(--color-success-50)', 'var(--color-success-700)'],
]
const palette = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Up to two initials from an office name, for the no-logo fallback. */
function officeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^(of|the|and|for|in)$/i.test(w))
  const letters = (words.length ? words : name.trim().split(/\s+/)).map((w) => w[0]).filter(Boolean)
  return letters.slice(0, 2).join('').toUpperCase()
}

/**
 * Per-office logo. Renders the uploaded image when the office has one, and
 * otherwise a clean monogram of the office's initials in a tinted circle.
 */
function OfficeLogo({ office, bg, fg, size = 44, square = false }: { office: Office; bg: string; fg: string; size?: number; square?: boolean }) {
  const [broken, setBroken] = useState(false)
  const showImage = !!office.logo_url && !broken

  return (
    <span
      className={`flex flex-none items-center justify-center overflow-hidden ${square ? 'rounded-[30%]' : 'rounded-full'}`}
      style={{ width: size, height: size, background: showImage ? '#FFFFFF' : bg, color: fg, border: showImage ? '1px solid var(--color-ink-200)' : 'none' }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={office.logo_url as string}
          alt={`${office.name} logo`}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="font-bold leading-none" style={{ fontSize: size * 0.36 }}>
          {officeInitials(office.name) || <Building2 style={{ width: size * 0.5, height: size * 0.5 }} />}
        </span>
      )}
    </span>
  )
}

/** Prints a clean one-page QR sheet (office name + code) through a hidden iframe, so the page behind the modal isn't printed. */
function printOfficeQr(name: string, svg: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) { frame.remove(); return }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Office QR — ${esc(name)}</title><style>
    @page { size: A4 portrait; margin: 18mm; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #0B2716; }
    .card { border: 1.5px solid #0B2716; border-radius: 14px; padding: 14mm 12mm; text-align: center; }
    .kicker { font-size: 11pt; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; margin: 0; }
    h1 { font-size: 24pt; margin: 4mm 0 8mm; line-height: 1.2; }
    svg { width: 90mm; height: 90mm; }
    .how { font-size: 14pt; font-weight: 600; margin: 8mm 0 2mm; }
    .note { font-size: 10.5pt; color: #333; margin: 0; }
    .foot { font-size: 9pt; color: #555; margin-top: 10mm; }
  </style></head><body><div class="card">
    <p class="kicker">SWAP Attendance</p>
    <h1>${esc(name)}</h1>
    ${svg}
    <p class="how">Scan with your phone camera to clock in / out</p>
    <p class="note">Open the link, sign in, and confirm your location when asked.</p>
    <p class="foot">Division of Student Affairs · MSU Marawi</p>
  </div></body></html>`)
  doc.close()
  const cleanup = () => setTimeout(() => frame.remove(), 500)
  win.addEventListener('afterprint', cleanup)
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => frame.isConnected && frame.remove(), 60_000) // fallback if afterprint never fires
  }, 150)
}

/** A read-only value with a copy-to-clipboard button — manual fallback when the QR won't scan. */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!(await copyText(value))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-ink-50 px-2.5 py-1.5 text-xs font-mono text-ink-900 focus:border-brand-700 focus:outline-none"
        />
        <button
          onClick={copy}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-350 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/10'
const labelCls = 'mb-1.5 block text-[12.5px] font-semibold text-ink-600'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Office logo chooser: shows the current logo (or the pending pick), validates
 * type and size in the browser so a bad file never reaches the API, and lets the
 * admin replace or remove an existing one.
 */
function LogoPicker({ name, currentUrl, file, remove, onPick, onRemove, onUndoRemove }: {
  name: string
  currentUrl: string | null
  file: File | null
  remove: boolean
  onPick: (file: File) => void
  onRemove: () => void
  onUndoRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Preview the pending file, and release the object URL when it changes.
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shown = previewUrl ?? (remove ? null : currentUrl)
  // A stored logo whose file is gone shows the initials, like the office cards do.
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [shown])

  const choose = (picked: File | undefined) => {
    if (!picked) return
    if (!LOGO_TYPES.includes(picked.type)) {
      setError('The logo must be a JPG, PNG or WEBP image.')
      return
    }
    if (picked.size > LOGO_MAX_BYTES) {
      setError('The logo must be 2 MB or smaller.')
      return
    }
    setError(null)
    onPick(picked)
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full border border-ink-200 bg-ink-50 text-brand-700"
        >
          {shown && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Office logo preview" onError={() => setBroken(true)} className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-lg font-bold leading-none">{officeInitials(name) || '\u2014'}</span>
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }}
          />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 hover:bg-ink-50 transition-colors">
            {shown ? 'Replace logo' : 'Upload logo'}
          </button>
          {shown && (
            <button type="button" onClick={onRemove}
              className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 hover:bg-ink-50 transition-colors">
              Remove
            </button>
          )}
          {remove && !previewUrl && currentUrl && (
            <button type="button" onClick={onUndoRemove}
              className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 hover:bg-ink-50 transition-colors">
              Undo
            </button>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-ink-400">JPG, PNG or WEBP, up to 2 MB. Offices without a logo show their initials.</p>
      {remove && !previewUrl && <p className="mt-1 text-[11px] font-medium text-warning-700">The logo will be removed when you save.</p>}
      {error && <p className="mt-1 text-[11px] font-medium text-danger-700">{error}</p>}
    </div>
  )
}

/** The students placed in an office (supervisors are managed in the office drawer). */
function OfficeRecipientsModal({ office, onClose }: { office: Office; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['office-assignments', office.id],
    queryFn: () => assignmentsApi.getAssignments({ office_id: String(office.id) }),
  })
  const assignments = data?.data ?? []

  return (
    <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink-950">{office.name}</h2>
            <p className="text-sm text-ink-500">Students placed here</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-brand-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-700" />
          <h3 className="text-sm font-semibold text-ink-950">Recipients</h3>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-200" />)}</div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-9 w-9 text-ink-300" />
            <p className="text-sm font-medium text-ink-400">No recipients assigned to this office yet.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 flex-shrink-0 text-brand-700" />
                      <p className="font-semibold text-ink-950">{a.user?.name ?? '—'}</p>
                    </div>
                    <p className="ml-6 text-xs text-ink-500">{a.user?.email ?? '—'}</p>
                    <p className="ml-6 mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
                      <UserCog className="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />
                      Supervisor: <span className="font-medium text-ink-950">{a.supervisor?.name ?? 'Unassigned'}</span>
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-2 ml-6 text-xs text-ink-500">
                  {formatHours(a.verified_hours)} verified / {a.required_hours}h required · {a.academic_year} — {a.semester}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status ─────────────────────────────────────────────────────────────────

type StatusKey = 'ready' | 'setup' | 'off'
type MissingKey = 'supervisor' | 'location' | 'clock_in_area'
const MISSING_LABEL: Record<MissingKey, string> = { supervisor: 'Supervisor', location: 'Location', clock_in_area: 'Clock-in area' }

/** Same rule as Office::isReady on the server (the list carries `ready` / `missing`). */
const statusOf = (o: Office): StatusKey => (!o.is_active ? 'off' : o.ready ? 'ready' : 'setup')
const missingOf = (o: Office): MissingKey[] => (o.missing ?? []) as MissingKey[]

const STATUS: Record<StatusKey, { label: string; Icon: typeof CheckCircle2; tone: string }> = {
  ready: { label: 'Ready', Icon: CheckCircle2, tone: 'bg-accent-soft text-accent-strong' },
  setup: { label: 'Needs setup', Icon: Construction, tone: 'bg-gold-50 text-warning-700' },
  off: { label: 'Closed', Icon: PauseCircle, tone: 'bg-ink-100 text-ink-500' },
}

function StatusPill({ k, small }: { k: StatusKey; small?: boolean }) {
  const s = STATUS[k]
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-full font-bold ${s.tone} ${small ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-1 text-[11.5px]'}`}>
      <s.Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  )
}

const GEO_CHOICES = [30, 50, 100, 150]
const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'

// ── Drawer ─────────────────────────────────────────────────────────────────

type Sup = { id: number; name: string; office_id?: number | null }
type LogoChange = { file: File | null; remove: boolean }

/**
 * The right-hand panel for one office (like Assignments' "Assigning" panel): the 3-step setup
 * (supervisors, location + map pin, clock-in area), student slots, open/closed, more details, and
 * Save. Nothing is sent until Save (new offices are created on Save). Unsaved changes are reported
 * up, so the page asks before switching to another office.
 */
function OfficePanel({ office, offices, allSupervisors, nextLeft, onNext, onClose, onSaved, onRecipients, onQr, onDirtyChange }: {
  office: Office | null // null = new office
  offices: Office[]
  allSupervisors: Sup[]
  nextLeft: number
  onNext: () => void
  onClose: () => void
  onSaved: (id: number) => Promise<void>
  onRecipients: (o: Office) => void
  onQr: (o: Office) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { notify, notifyError, confirm } = useFeedback()
  const isNew = !office
  const initial: Partial<Office> = office ?? {
    name: '', description: '', head_name: '', location: '', max_recipients: 10, is_active: true,
    geofence_enabled: false, radius_meters: null, auto_clock_out: true, latitude: null, longitude: null,
  }
  const [form, setForm] = useState<Partial<Office>>(initial)
  const [logo, setLogo] = useState<LogoChange>({ file: null, remove: false })
  const [adds, setAdds] = useState<number[]>([])
  const [removes, setRemoves] = useState<number[]>([])
  const [pick, setPick] = useState('')
  const [more, setMore] = useState(isNew)
  const [otherGeo, setOtherGeo] = useState(!!office?.radius_meters && !GEO_CHOICES.includes(office.radius_meters))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = (patch: Partial<Office>) => setForm((f) => ({ ...f, ...patch }))
  const lat = toNum(form.latitude)
  const lng = toNum(form.longitude)
  const filled = office?.active_recipients ?? 0

  // Supervisors as they will be after Save.
  const current = (office?.supervisors ?? []).filter((s) => !removes.includes(s.id))
  const added = allSupervisors.filter((s) => adds.includes(s.id))
  const supList: Sup[] = [...current, ...added]
  const officeName = (id?: number | null) => offices.find((o) => o.id === id)?.name ?? 'another office'
  const options = allSupervisors.filter((s) => !supList.some((x) => x.id === s.id))

  // Setup steps, from the draft.
  const steps = {
    supervisor: supList.length > 0,
    location: lat !== null && lng !== null,
    clock_in_area: !!form.geofence_enabled && !!form.radius_meters,
  }
  const done = Object.values(steps).filter(Boolean).length
  const draftStatus: StatusKey = !form.is_active ? 'off' : done === 3 ? 'ready' : 'setup'

  const dirty = isNew
    || JSON.stringify(pickFields(form)) !== JSON.stringify(pickFields(initial))
    || adds.length > 0 || removes.length > 0 || !!logo.file || logo.remove

  const leave = async (go: () => void) => {
    if (dirty && !isNew && !(await confirm({ title: 'Discard changes?', body: 'Your changes to this office are not saved.', confirmLabel: 'Discard', tone: 'danger' }))) return
    if (dirty && isNew && (form.name ?? '').trim() && !(await confirm({ title: 'Discard this new office?', body: 'It has not been created yet.', confirmLabel: 'Discard', tone: 'danger' }))) return
    go()
  }

  // The page asks "Discard changes?" before switching away while this is true.
  useEffect(() => { onDirtyChange(dirty && !(isNew && !(form.name ?? '').trim())) }, [dirty, isNew, form.name, onDirtyChange])

  const save = async () => {
    if (!(form.name ?? '').trim()) { notify({ tone: 'error', title: 'Give the office a name', detail: null }); setMore(true); return }
    setSaving(true)
    try {
      const body = pickFields(form)
      const saved = isNew ? await assignmentsApi.createOffice(body) : await assignmentsApi.updateOffice(office!.id, body)
      const id = saved.id ?? office!.id
      if (logo.file) await assignmentsApi.uploadOfficeLogo(id, logo.file)
      else if (logo.remove) await assignmentsApi.removeOfficeLogo(id)
      for (const sid of removes) await assignmentsApi.removeSupervisorFromOffice(id, sid)
      for (const sid of adds) await assignmentsApi.assignSupervisorToOffice(id, sid)
      await onSaved(id)
      notify({ title: isNew ? 'Office added' : 'Saved', detail: done === 3 && form.is_active ? `${form.name} is ready for students.` : null })
    } catch (e) {
      notifyError(e, 'Could not save the office')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!office) return
    setDeleting(true)
    try {
      await assignmentsApi.deleteOffice(office.id)
      notify({ title: 'Office deleted', detail: null })
      await onSaved(0)
      onClose()
    } catch (e) {
      notifyError(e, 'Could not delete the office')
    } finally {
      setDeleting(false)
    }
  }

  const [bg, fg] = palette(office?.id ?? 0)
  const shown = { ...(office ?? {}), ...form, name: form.name || 'New office' } as Office
  const placeDone = steps.location && steps.clock_in_area
  const missingNow = [!steps.supervisor && 'supervisor', !placeDone && 'location'].filter(Boolean) as string[]
  const headline = draftStatus === 'ready' ? 'Students can be placed and clock in here.'
    : draftStatus === 'off' ? 'Closed to new placements.'
      : `${2 - missingNow.length} of 2 steps done — add the ${missingNow.join(' and ')}.`
  const cap = form.max_recipients ?? 0
  const fillPct = cap ? Math.min(100, Math.round((filled / cap) * 100)) : 0
  const isReady = !isNew && office ? statusOf(office) === 'ready' : false

  // A numbered circle that turns into a green check once the step is done.
  const stepDot = (ok: boolean, n: number) => (
    <span className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${ok ? 'bg-accent text-white' : 'bg-gold-50 text-warning-700'}`}>
      {ok ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : n}
    </span>
  )
  // Phones: the options share the row evenly (5 sizes overflowed the card).
  const SEG = 'grid w-full auto-cols-fr grid-flow-col gap-0.5 rounded-[11px] bg-ink-100 p-[3px] sm:flex sm:w-auto'
  const segBtn = (on: boolean) => `h-[34px] min-w-0 rounded-[9px] px-1.5 text-[12.5px] sm:px-3.5 sm:text-[13px] font-bold ${on ? 'bg-surface text-accent-strong shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-600 hover:text-ink-900'}`

  return (
    <div aria-label={shown.name} className={`${CARD} overflow-hidden rounded-[20px]`}>
      {/* Header: dark green with a gold glow */}
      <div className="flex flex-wrap items-center gap-3.5 bg-accent-deep px-6 py-5 text-white"
        style={{ backgroundImage: 'radial-gradient(120% 160% at 100% 0%, rgba(221,187,56,.25), transparent 50%)' }}>
        <OfficeLogo office={shown} size={48} square bg="rgba(255,255,255,.14)" fg="#FFFFFF" />
        <div className="min-w-0 flex-1 basis-[160px]">
          <p className="break-words text-[19px] font-extrabold leading-tight">{shown.name}</p>
          <p className="mt-0.5 text-[12.5px] text-white/75">{isNew ? 'Name the office, then set it up below.' : headline}</p>
        </div>
        <StatusPill k={draftStatus} />
        <button type="button" onClick={() => leave(onClose)} aria-label={isNew ? 'Cancel new office' : 'Close'}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-white/15 text-white hover:bg-white/25">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 pb-1 pt-2">
        {isNew && (
          <label className="block border-b border-ink-900/[.06] py-[18px]">
            <span className="mb-1.5 block text-[15px] font-bold text-ink-950">Office name</span>
            <input value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. College of Agriculture" className={inputCls} />
          </label>
        )}

        {/* 1. Supervisor */}
        <div className="flex gap-4 border-b border-ink-900/[.06] py-[18px]">
          {stepDot(steps.supervisor, 1)}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div>
              <p className="text-[15px] font-bold text-ink-950">Supervisor <span className="text-[12.5px] font-medium text-ink-400">(office head)</span></p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">The head of this office, who verifies hours here. Each supervisor handles one office.</p>
            </div>
            {supList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {supList.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface py-1 pl-2.5 pr-1 text-[13px] font-medium text-ink-900">
                    <UserIcon className="h-3.5 w-3.5 text-ink-400" />{s.name}
                    {adds.includes(s.id) && <span className="text-[11px] font-semibold text-accent-strong">new</span>}
                    <button type="button" aria-label={`Remove ${s.name}`}
                      onClick={async () => {
                        if (adds.includes(s.id)) { setAdds((a) => a.filter((x) => x !== s.id)); return }
                        if (!(await confirm({
                          title: `Remove ${s.name}?`,
                          body: `${s.name} will no longer supervise ${shown.name} once you press Save. Their current students keep their placements.`,
                          confirmLabel: 'Remove', tone: 'danger',
                        }))) return
                        setRemoves((r) => (r.includes(s.id) ? r : [...r, s.id]))
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-ink-400 hover:bg-danger-50 hover:text-danger-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-ink-200 bg-surface px-3 focus-within:border-accent">
              <UserIcon className="h-5 w-5 flex-none text-ink-400" />
              <select value={pick} aria-label="Add a supervisor" onChange={(e) => {
                const id = Number(e.target.value)
                if (id) {
                  // Picking back someone removed from this office just undoes the removal (no duplicate).
                  if ((office?.supervisors ?? []).some((s) => s.id === id)) setRemoves((r) => r.filter((x) => x !== id))
                  else setAdds((a) => (a.includes(id) ? a : [...a, id]))
                }
                setPick('')
              }} className="h-11 min-w-0 flex-1 cursor-pointer border-none bg-transparent text-[14px] text-ink-950 focus:outline-none">
                <option value="">{options.length ? (supList.length ? 'Add another supervisor…' : 'Choose a supervisor…') : 'No more supervisors'}</option>
                {options.map((s) => {
                  const elsewhere = s.office_id != null && s.office_id !== office?.id
                  return <option key={s.id} value={s.id} disabled={elsewhere}>{s.name}{elsewhere ? ` — already at ${officeName(s.office_id)}` : ''}</option>
                })}
              </select>
            </div>
            <span className="text-[12px] text-ink-400">Not on the list? <Link href="/admin/users" className="font-semibold text-accent hover:text-accent-hover">Invite them in Users</Link></span>
          </div>
        </div>

        {/* 2. Location & clock-in area */}
        <div className="flex gap-4 border-b border-ink-900/[.06] py-[18px]">
          {stepDot(placeDone, 2)}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="text-[15px] font-bold text-ink-950">Location &amp; clock-in area</p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">Click the map where the office is. Recipients can only clock in inside the green circle.</p>
            </div>
            {/* isolate: keeps Leaflet's own z-indexes (400–1000) inside the map, so pop-ups such as
                the recipients list and the QR window stay on top of it. */}
            <div className="relative isolate z-0">
              <OfficeMapPicker
                latitude={lat}
                longitude={lng}
                radius={form.radius_meters ?? 50}
                onChange={(la, ln) => set({ latitude: la, longitude: ln, geofence_enabled: true, radius_meters: form.radius_meters ?? 50 })}
                onRadiusChange={(r) => set({ radius_meters: r, geofence_enabled: true })}
                height={320}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] font-semibold text-ink-700">Circle size</span>
              <div className={SEG}>
                {GEO_CHOICES.map((m) => (
                  <button key={m} type="button" onClick={() => { setOtherGeo(false); set({ radius_meters: m, geofence_enabled: true }) }}
                    className={segBtn(!otherGeo && !!form.geofence_enabled && form.radius_meters === m)}>{m} m</button>
                ))}
                <button type="button" onClick={() => { setOtherGeo(true); set({ geofence_enabled: true, radius_meters: form.radius_meters ?? 70 }) }}
                  className={segBtn(otherGeo)}>Other</button>
              </div>
              <span className="text-[12px] text-ink-400">
                {otherGeo ? 'Custom size' : RADIUS_HINT[form.radius_meters ?? 0] ?? ''}
              </span>
            </div>
            {otherGeo && (
              <label className="flex items-center gap-2 text-[13px] text-ink-700">
                <input type="number" min={10} max={1000} value={form.radius_meters ?? ''}
                  onChange={(e) => set({ radius_meters: e.target.value ? Math.min(1000, Math.max(10, Number(e.target.value))) : null, geofence_enabled: true })}
                  className={`${inputCls} w-28`} /> meters (10–1000)
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-900">Room or floor <span className="font-medium text-ink-400">(optional, shown to students)</span></span>
              <input value={form.location ?? ''} onChange={(e) => set({ location: e.target.value })}
                placeholder="e.g. Admin Bldg, 2nd floor, Room 204" className={inputCls} />
            </label>
          </div>
        </div>

        {/* Slots, open/closed, recipients and QR */}
        <div className="flex gap-4 py-[18px]">
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-ink-100 text-ink-500"><Users className="h-[17px] w-[17px]" /></span>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="min-w-[180px] flex-1">
                <p className="text-[15px] font-bold text-ink-950">Student slots</p>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div className="bar-grow-x h-full rounded-full bg-accent" style={{ width: `${fillPct}%` }} />
                  </div>
                  <span className="text-[12.5px] text-ink-500">{filled} placed · {Math.max(0, cap - filled)} open</span>
                </div>
              </div>
              <div className="flex items-center rounded-xl border-[1.5px] border-ink-200">
                <button type="button" aria-label="Fewer slots" onClick={() => set({ max_recipients: Math.max(filled, (form.max_recipients ?? 1) - 1, 1) })}
                  className="flex h-[42px] w-[42px] items-center justify-center text-ink-700 hover:text-accent-strong"><Minus className="h-4 w-4" /></button>
                <input value={form.max_recipients ?? ''} inputMode="numeric" aria-label="Student slots"
                  onChange={(e) => { const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10); set({ max_recipients: Number.isFinite(n) ? n : 1 }) }}
                  onBlur={() => set({ max_recipients: Math.max(filled, form.max_recipients ?? 1, 1) })}
                  className="w-10 border-none bg-transparent text-center text-[15px] font-extrabold text-ink-950 focus:outline-none" />
                <button type="button" aria-label="More slots" onClick={() => set({ max_recipients: (form.max_recipients ?? 0) + 1 })}
                  className="flex h-[42px] w-[42px] items-center justify-center text-ink-700 hover:text-accent-strong"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex-1">
                <p className="text-[15px] font-bold text-ink-950">Open for placements</p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">{form.is_active ? 'New students can be placed here.' : 'Closed. Current recipients stay; no new placements.'}</p>
              </div>
              <button type="button" role="switch" aria-checked={!!form.is_active} aria-label="Open for placements" onClick={() => set({ is_active: !form.is_active })}
                className={`flex h-[30px] w-[50px] flex-none rounded-full p-[3px] transition-colors ${form.is_active ? 'justify-end bg-accent' : 'justify-start bg-ink-300'}`}>
                <span className="h-6 w-6 rounded-full bg-white shadow" />
              </button>
            </div>
            {!isNew && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onRecipients(office!)}
                  className="flex h-10 items-center gap-1.5 rounded-[11px] border border-ink-200 bg-surface px-3.5 text-[13px] font-semibold text-ink-900 hover:bg-ink-50">
                  <Users className="h-[18px] w-[18px]" /> See recipients
                </button>
                <button type="button" onClick={() => onQr(office!)} disabled={!isReady} title={isReady ? 'Office QR' : 'Set the office up first'}
                  className="flex h-10 items-center gap-1.5 rounded-[11px] border border-ink-200 bg-surface px-3.5 text-[13px] font-semibold text-ink-900 hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-350 disabled:hover:bg-surface">
                  <QrCode className="h-[18px] w-[18px]" /> Office QR
                </button>
              </div>
            )}
          </div>
        </div>

        {/* More details */}
        <section className="mb-4 rounded-xl border border-ink-200">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
            className="flex w-full items-center justify-between px-4 py-3 text-[13.5px] font-semibold text-ink-900">
            More details <ChevronDown className={`h-4 w-4 text-ink-400 transition-transform ${more ? 'rotate-180' : ''}`} />
          </button>
          {more && (
            <div className="space-y-4 border-t border-ink-200 px-4 py-4">
              {!isNew && (
                <label className="block">
                  <span className={labelCls}>Office name</span>
                  <input value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
                </label>
              )}
              <label className="block">
                <span className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></span>
                <textarea value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} className={inputCls} />
              </label>
              <div>
                <span className={labelCls}>Logo <span className="font-normal text-ink-400">(optional)</span></span>
                <LogoPicker name={form.name ?? ''} currentUrl={office?.logo_url ?? null} file={logo.file} remove={logo.remove}
                  onPick={(f) => setLogo({ file: f, remove: false })} onRemove={() => setLogo({ file: null, remove: true })}
                  onUndoRemove={() => setLogo({ file: null, remove: false })} />
              </div>
              <label className="flex items-start gap-2.5 text-[13px] text-ink-900">
                <input type="checkbox" checked={form.auto_clock_out !== false} onChange={(e) => set({ auto_clock_out: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-700" />
                <span>Automatic clock-out when a student leaves the area
                  <span className="block text-[12px] text-ink-500">Turn off for offices that send students on errands; they clock out by scanning the QR.</span>
                </span>
              </label>
              {!isNew && filled === 0 && (confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-danger-50 p-3 text-[12.5px] text-danger-800">
                  <span className="flex-1">Delete {office!.name}? This can&apos;t be undone.</span>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 font-semibold text-ink-700">Keep</button>
                  <button type="button" onClick={remove} disabled={deleting} className="rounded-lg bg-danger-700 px-3 py-1.5 font-bold text-white hover:bg-danger-800 disabled:opacity-60">
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-700 hover:text-danger-800">
                  <Trash2 className="h-4 w-4" /> Delete office
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/[.06] bg-ink-50/60 px-6 py-3.5">
        <span className={`flex flex-1 items-center gap-1.5 text-[12.5px] ${dirty ? 'font-semibold text-warning-700' : 'text-ink-500'}`}>
          {dirty ? <><span className="h-2 w-2 rounded-full bg-gold-accent" /> Unsaved changes</> : <><CheckCircle2 className="h-4 w-4 text-accent" /> All changes saved</>}
        </span>
        <button type="button" onClick={save} disabled={saving || !dirty}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-bold text-white hover:bg-accent-hover disabled:opacity-50">
          <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> {saving ? 'Saving…' : isNew ? 'Add office' : 'Save'}
        </button>
        {!isNew && nextLeft > 0 && (
          <button type="button" onClick={() => leave(onNext)}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-4 text-[13.5px] font-bold text-accent-strong hover:bg-accent-tint">
            Next office to set up <span className="text-[12px] font-semibold text-ink-500">{nextLeft} left</span> <ArrowRight className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </div>
  )
}

const RADIUS_HINT: Record<number, string> = { 30: 'One room', 50: 'One building', 100: 'Building + grounds', 150: 'Large area' }

/** The fields the office form sends (and compares to detect changes). */
function pickFields(o: Partial<Office>) {
  return {
    name: (o.name ?? '').trim(),
    description: o.description || null,
    // No separate "office head": the supervisor is the head (step 1). Not sent, so stored values stay.
    location: o.location || null,
    max_recipients: o.max_recipients ?? 1,
    is_active: !!o.is_active,
    latitude: toNum(o.latitude),
    longitude: toNum(o.longitude),
    radius_meters: o.radius_meters ?? null,
    geofence_enabled: !!o.geofence_enabled,
    auto_clock_out: o.auto_clock_out !== false,
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

type Tab = 'all' | StatusKey

/**
 * Admin → Offices (layout "SWAP Admin Offices v3"): every office is Ready, Needs setup or Closed.
 * Two parts like Assignments: the list on the left, the picked office's setup/edit panel on the right.
 * New placements are refused server-side in an office that isn't ready (AssignmentService).
 */
export default function AdminOfficesPage() {
  const queryClient = useQueryClient()
  const { notifyError, confirm } = useFeedback()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  // 'new' = a blank add-office panel; a number = that office; null = no panel (list full width).
  const [cur, setCur] = useState<number | 'new' | null>(null)
  const [version, setVersion] = useState(0)
  // The panel has unsaved changes.
  const [dirty, setDirty] = useState(false)
  const [qrView, setQrView] = useState<{ name: string; token: string } | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  const [viewOffice, setViewOffice] = useState<Office | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-offices'],
    queryFn: () => assignmentsApi.getOffices({ per_page: '100' }),
  })
  const { data: supData } = useQuery({
    queryKey: ['all-supervisors'],
    queryFn: () => adminApi.getUsers({ role: 'supervisor', per_page: '100' }),
  })
  const allSupervisors: Sup[] = (supData?.data ?? []).map((u) => ({ id: u.id, name: u.name, office_id: u.office_id }))

  const officeQr = useMutation({
    mutationFn: (office: Office) => assignmentsApi.generateOfficeQr(office.id).then((r) => ({ name: office.name, token: r.data.qr_code })),
    onSuccess: (res) => setQrView(res),
    onError: (e) => notifyError(e, 'Could not generate the office QR'),
  })

  const offices = data?.data ?? []
  const totalOffices = data?.meta?.total ?? offices.length
  const counts: Record<Tab, number> = { all: offices.length, ready: 0, setup: 0, off: 0 }
  offices.forEach((o) => { counts[statusOf(o)]++ })

  const q = search.trim().toLowerCase()
  const supNames = (o: Office) => (o.supervisors ?? []).map((s) => s.name).join(', ')
  const list = offices
    .filter((o) => (tab === 'all' || statusOf(o) === tab) && (!q || `${o.name} ${supNames(o)}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Setup queue: needs setup first, then closed, by name.
  const rank: Record<StatusKey, number> = { setup: 0, off: 1, ready: 2 }
  const needSetup = offices.filter((o) => statusOf(o) === 'setup')
    .sort((a, b) => rank[statusOf(a)] - rank[statusOf(b)] || a.name.localeCompare(b.name))
  const current = typeof cur === 'number' ? offices.find((o) => o.id === cur) ?? null : null
  const nextList = needSetup.filter((o) => o.id !== current?.id)

  const refresh = async (id: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-offices-list'] }),
      queryClient.invalidateQueries({ queryKey: ['all-supervisors'] }),
    ])
    setVersion((v) => v + 1)
    if (id) setCur(id)
  }

  const TABS: [Tab, string][] = [['setup', 'To set up'], ['ready', 'Ready'], ['off', 'Closed'], ['all', 'All']]
  // Open on "To set up" while any office needs it (once, when the list first loads).
  const tabChosen = useRef(false)
  useEffect(() => {
    if (tabChosen.current || !data) return
    tabChosen.current = true
    if (offices.some((o) => statusOf(o) === 'setup')) setTab('setup')
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // The panel opens only once an office is clicked (or Add office); the list is full width until then.
  const shownOffice = cur === 'new' ? null : current
  const panelOpen = cur === 'new' || !!shownOffice
  // Switching away from unsaved changes asks first (the panel reports them).
  const go = async (next: () => void) => {
    if (dirty && !(await confirm({ title: 'Discard changes?', body: 'Your changes to this office are not saved.', confirmLabel: 'Discard', tone: 'danger' }))) return
    setDirty(false)
    next()
  }
  const pick = (id: number | 'new') => go(() => {
    setCur(id)
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      setTimeout(() => document.getElementById('office-panel')?.scrollIntoView({ behavior: 'smooth' }), 0)
    }
  })
  const readyPct = counts.all ? Math.round((counts.ready / counts.all) * 100) : 0
  // Supervisor · location · clock-in area, done or missing.
  const dots = (o: Office) => {
    const miss = missingOf(o)
    return (['supervisor', 'location', 'clock_in_area'] as MissingKey[]).map((k) => ({ k, ok: o.ready || !miss.includes(k) }))
  }
  const subLine = (o: Office) => {
    const st = statusOf(o)
    if (st === 'off') return 'Closed'
    if (st === 'setup') return `Needs ${missingOf(o).map((m) => MISSING_LABEL[m].toLowerCase()).join(' & ')}`
    return `${supNames(o) || 'No supervisor'} · ${Math.max(0, o.max_recipients - (o.active_recipients ?? 0))} open`
  }

  return (
    <div className="space-y-[18px]">
      {/* Header: title, readiness, Add office */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-.02em] text-ink-950">Offices</h1>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1.5 w-[180px] overflow-hidden rounded-full bg-ink-200">
              <div className="bar-grow-x h-full rounded-full bg-accent" style={{ width: `${readyPct}%` }} />
            </div>
            <span className="text-[13px] text-ink-600"><b className="text-ink-950">{counts.ready} of {counts.all}</b> ready for students</span>
          </div>
          {totalOffices > offices.length && (
            <p className="mt-1 text-[12.5px] text-warning-700">Showing the first {offices.length} of {totalOffices} offices. Use search to find the rest.</p>
          )}
        </div>
        <button type="button" onClick={() => pick('new')}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-[18px] text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(23,129,95,.25)] hover:bg-accent-hover">
          <Plus className="h-5 w-5" strokeWidth={2.5} /> Add office
        </button>
      </div>

      <div className={`grid items-start gap-5 ${panelOpen ? 'lg:grid-cols-[minmax(300px,.85fr)_minmax(0,1.25fr)]' : ''}`}>
        {/* Left: the office list */}
        <div className={`${CARD} flex flex-col overflow-hidden rounded-[20px] lg:sticky lg:top-4 lg:max-h-[calc(100dvh-120px)]`}>
          <div className="flex flex-col gap-2.5 border-b border-ink-900/[.06] p-3.5">
            <div className="flex h-[42px] items-center gap-2 rounded-xl bg-ink-100/70 px-3 focus-within:ring-2 focus-within:ring-accent/30">
              <Search className="h-[18px] w-[18px] flex-none text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search office or supervisor" aria-label="Search offices"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-ink-950 placeholder:text-ink-400 focus:outline-none" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700"><X className="h-4 w-4" /></button>}
            </div>
            <div className="flex gap-0.5 rounded-[11px] bg-ink-100 p-[3px]" role="tablist">
              {TABS.map(([k, label]) => {
                const on = tab === k
                return (
                  <button key={k} type="button" role="tab" aria-selected={on} onClick={() => go(() => { setTab(k); setCur(null) })}
                    className={`flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[9px] px-1.5 text-[12.5px] font-semibold ${
                      on ? 'bg-surface text-ink-950 shadow-[0_1px_3px_rgba(20,40,30,.15)]' : 'text-ink-500 hover:text-ink-800'}`}>
                    {label}<span className="text-[11px] font-bold opacity-60">{counts[k]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {isLoading ? (
              <div className="space-y-2 p-3.5">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-[54px] animate-pulse rounded-xl bg-ink-200/50" />)}</div>
            ) : list.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-ink-500">
                {offices.length === 0 ? 'No offices yet. Add your first host office.' : 'No offices match.'}
              </p>
            ) : list.map((o) => {
              const st = statusOf(o)
              const [bg, fg] = palette(o.id)
              const on = cur !== 'new' && shownOffice?.id === o.id
              const d = dots(o)
              const missing = d.filter((x) => !x.ok).map((x) => MISSING_LABEL[x.k].toLowerCase())
              return (
                <button key={o.id} type="button" onClick={() => pick(o.id)} aria-current={on}
                  className={`flex w-full items-center gap-3 border-b border-ink-900/[.04] px-4 py-3 text-left transition-colors ${
                    on ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-ink-50'}`}>
                  <OfficeLogo office={o} size={38} square bg={st === 'off' ? 'var(--color-ink-100)' : bg} fg={st === 'off' ? 'var(--text-ink-400)' : fg} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13.5px] leading-snug text-ink-950 ${on ? 'font-bold' : 'font-semibold'}`}>{o.name}</span>
                    <span className={`mt-0.5 block truncate text-[12px] ${st === 'setup' ? 'text-warning-700' : 'text-ink-500'}`}>{subLine(o)}</span>
                  </span>
                  <span className="flex flex-none gap-[3px]" title={missing.length ? `Missing: ${missing.join(', ')}` : 'All set'}>
                    {d.map((x) => <span key={x.k} className={`h-[7px] w-[7px] rounded-full ${x.ok ? 'bg-accent' : 'bg-ink-200'}`} />)}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/[.06] px-4 py-2.5 text-[11.5px] text-ink-400">
            <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-accent" />done</span>
            <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-ink-200" />missing</span>
            <span>· supervisor, location, clock-in area</span>
          </div>
        </div>

        {/* Right: the selected office */}
        {panelOpen && (
          <div id="office-panel" className="animate-panel-in scroll-mt-4">
            <OfficePanel key={`${cur === 'new' ? 'new' : shownOffice?.id}-${version}`} office={cur === 'new' ? null : shownOffice} offices={offices}
              allSupervisors={allSupervisors} nextLeft={nextList.length} onNext={() => nextList[0] && setCur(nextList[0].id)}
              onClose={() => { setDirty(false); setCur(null) }} onSaved={refresh} onDirtyChange={setDirty}
              onRecipients={(o) => setViewOffice(o)} onQr={(o) => officeQr.mutate(o)} />
          </div>
        )}
      </div>

      {/* Office QR */}
      {qrView && (
        <div className="sheet-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setQrView(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-semibold text-ink-900">Office QR — {qrView.name}</h2>
              <button onClick={() => setQrView(null)} aria-label="Close" className="text-ink-350 hover:text-danger-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div ref={qrRef} className="flex justify-center">
              <QrDisplay value={`${window.location.origin}/scan?t=${encodeURIComponent(qrView.token)}`} size={220} caption={qrView.name} />
            </div>
            <button type="button"
              onClick={() => { const svg = qrRef.current?.querySelector('svg'); if (svg) printOfficeQr(qrView.name, svg.outerHTML) }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
              <Printer className="h-4 w-4" /> Print QR
            </button>
            <p className="mt-3 text-center text-xs text-ink-500">
              Print and post this at the office entrance. Recipients scan it with their phone camera to clock in.
            </p>
            <div className="mt-4 space-y-3 border-t border-ink-200 pt-4">
              <p className="text-xs font-medium text-ink-500">Manual fallback (if the camera won&apos;t scan):</p>
              <CopyField label="Scan link — open in a phone browser" value={`${window.location.origin}/scan?t=${encodeURIComponent(qrView.token)}`} />
              <CopyField label="QR token — paste in Attendance → QR Token" value={qrView.token} />
            </div>
          </div>
        </div>
      )}

      {viewOffice && <OfficeRecipientsModal office={viewOffice} onClose={() => setViewOffice(null)} />}
    </div>
  )
}
