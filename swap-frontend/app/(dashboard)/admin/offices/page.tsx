'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, X, Users, Copy, Check, Search, Trash2, User as UserIcon, CheckCircle2, Circle, Construction,
  PauseCircle, MapPin, QrCode, ChevronRight, ChevronDown, ArrowRight, Plus, Minus, Store, UserCog,
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
function OfficeLogo({ office, bg, fg, size = 44 }: { office: Office; bg: string; fg: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const showImage = !!office.logo_url && !broken

  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-full"
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
 * One office: the 3-step setup (supervisors, location + map pin, clock-in area), student slots,
 * open/closed, more details, and Save. Nothing is sent until Save (new offices are created on Save).
 */
function OfficeDrawer({ office, offices, allSupervisors, nextLeft, onNext, onClose, onSaved, onRecipients, onQr }: {
  office: Office | null // null = new office
  offices: Office[]
  allSupervisors: Sup[]
  nextLeft: number
  onNext: () => void
  onClose: () => void
  onSaved: (id: number) => Promise<void>
  onRecipients: (o: Office) => void
  onQr: (o: Office) => void
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

  // Escape closes, with the same "Discard changes?" check as the backdrop and the X.
  const leaveRef = useRef(leave)
  leaveRef.current = leave
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') leaveRef.current(onClose) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

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
  const tick = (ok: boolean) => ok
    ? <CheckCircle2 className="h-[18px] w-[18px] text-accent" />
    : <Circle className="h-[18px] w-[18px] text-ink-300" />

  return (
    <>
      <div onClick={() => leave(onClose)} className="sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={shown.name} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[880px] flex-col overflow-hidden rounded-[20px] bg-surface pb-safe shadow-[0_30px_70px_rgba(11,39,22,.35)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink-900/[.06] py-4 pl-6 pr-5">
          <OfficeLogo office={shown} bg={draftStatus === 'off' ? 'var(--color-ink-100)' : bg} fg={draftStatus === 'off' ? 'var(--text-ink-400)' : fg} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-[17px] font-extrabold leading-tight text-ink-950">{shown.name}</p>
            <div className="mt-1.5"><StatusPill k={draftStatus} small /></div>
          </div>
          <button type="button" onClick={() => leave(onClose)} aria-label="Close"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-ink-100 text-ink-700 hover:bg-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wide screens: setup on the left, the map in its own column. Phones: one column, map under Location. */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-2 lg:gap-x-7">
          <div className="space-y-5 lg:col-start-1">
          {isNew && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-900">Office name</span>
              <input value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. College of Agriculture" className={inputCls} />
            </label>
          )}

          {/* Setup */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-bold text-ink-950">Setup</span>
              <span className="text-[12.5px] text-ink-500">{done} of 3 done</span>
            </div>

            {/* 1. Supervisors */}
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">{tick(steps.supervisor)}Supervisors</span>
              {supList.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-ink-200 px-3 py-2">
                  <UserIcon className="h-4 w-4 flex-none text-ink-400" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-900">{s.name}</span>
                  {adds.includes(s.id) && <span className="text-[11px] font-semibold text-accent-strong">New</span>}
                  <button type="button" aria-label={`Remove ${s.name}`}
                    onClick={() => adds.includes(s.id) ? setAdds((a) => a.filter((x) => x !== s.id)) : setRemoves((r) => [...r, s.id])}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <select value={pick} onChange={(e) => {
                const id = Number(e.target.value)
                if (id) { setAdds((a) => [...a, id]); setRemoves((r) => r.filter((x) => x !== id)) }
                setPick('')
              }} className={`${inputCls} h-11 cursor-pointer`}>
                <option value="">{options.length ? 'Add supervisor…' : 'No more supervisors'}</option>
                {options.map((s) => {
                  const elsewhere = s.office_id != null && s.office_id !== office?.id
                  return <option key={s.id} value={s.id} disabled={elsewhere}>{s.name}{elsewhere ? ` — at ${officeName(s.office_id)}` : ''}</option>
                })}
              </select>
              <p className="text-[12px] text-ink-400">Each supervisor handles one office. Invite new supervisors in Users.</p>
            </div>

            {/* 2. Location */}
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">{tick(steps.location)}Location</span>
              <input value={form.location ?? ''} onChange={(e) => set({ location: e.target.value })}
                placeholder="Building and floor, e.g. Admin Bldg, 2nd floor" className={inputCls} />
              <p className="text-[12px] text-ink-400">{steps.location ? 'Pin set. Click the map to move it.' : 'Drop the office pin on the map. Clock-in checks it.'}</p>
            </div>
          </section>
          </div>

          <div className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <OfficeMapPicker
              latitude={lat}
              longitude={lng}
              radius={form.radius_meters ?? 50}
              onChange={(la, ln) => set({ latitude: la, longitude: ln })}
              onRadiusChange={(r) => set({ radius_meters: r, geofence_enabled: true })}
            />
          </div>

          <div className="space-y-5 lg:col-start-1">
          <section className="space-y-4">

            {/* 3. Clock-in area */}
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">{tick(steps.clock_in_area)}Clock-in area</span>
              <div className="grid grid-cols-5 gap-1.5">
                {GEO_CHOICES.map((m) => {
                  const on = !otherGeo && form.geofence_enabled && form.radius_meters === m
                  return (
                    <button key={m} type="button" onClick={() => { setOtherGeo(false); set({ radius_meters: m, geofence_enabled: true }) }}
                      className={`h-10 rounded-[11px] border-[1.5px] text-[13px] font-bold ${on ? 'border-accent bg-accent-tint text-accent-strong' : 'border-ink-200 bg-surface text-ink-700 hover:border-accent/50'}`}>
                      {m} m
                    </button>
                  )
                })}
                <button type="button" onClick={() => { setOtherGeo(true); set({ geofence_enabled: true, radius_meters: form.radius_meters ?? 70 }) }}
                  className={`h-10 rounded-[11px] border-[1.5px] text-[13px] font-bold ${otherGeo ? 'border-accent bg-accent-tint text-accent-strong' : 'border-ink-200 bg-surface text-ink-700 hover:border-accent/50'}`}>
                  Other
                </button>
              </div>
              {otherGeo && (
                <label className="flex items-center gap-2 text-[13px] text-ink-700">
                  <input type="number" min={10} max={1000} value={form.radius_meters ?? ''}
                    onChange={(e) => set({ radius_meters: e.target.value ? Math.min(1000, Math.max(10, Number(e.target.value))) : null, geofence_enabled: true })}
                    className={`${inputCls} w-28`} /> meters (10–1000)
                </label>
              )}
              <p className="text-[12px] text-ink-400">Recipients can only clock in within this distance of the pin.</p>
            </div>
          </section>

          <div className="h-px bg-ink-900/[.06]" />

          {/* Slots */}
          <div className="flex items-center gap-3.5">
            <div className="flex-1">
              <p className="text-[14px] font-bold text-ink-950">Student slots</p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">{filled} placed · {Math.max(0, (form.max_recipients ?? 0) - filled)} open</p>
            </div>
            <div className="flex items-center rounded-xl border-[1.5px] border-ink-200">
              <button type="button" aria-label="Fewer slots" onClick={() => set({ max_recipients: Math.max(filled, (form.max_recipients ?? 1) - 1, 1) })}
                className="flex h-10 w-10 items-center justify-center text-ink-700 hover:text-accent-strong"><Minus className="h-4 w-4" /></button>
              <input value={form.max_recipients ?? ''} inputMode="numeric" aria-label="Student slots"
                onChange={(e) => { const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10); set({ max_recipients: Number.isFinite(n) ? n : 1 }) }}
                onBlur={() => set({ max_recipients: Math.max(filled, form.max_recipients ?? 1, 1) })}
                className="w-11 border-none bg-transparent text-center text-[15px] font-extrabold text-ink-950 focus:outline-none" />
              <button type="button" aria-label="More slots" onClick={() => set({ max_recipients: (form.max_recipients ?? 0) + 1 })}
                className="flex h-10 w-10 items-center justify-center text-ink-700 hover:text-accent-strong"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Open for placements */}
          <div className="flex items-center gap-3.5">
            <div className="flex-1">
              <p className="text-[14px] font-bold text-ink-950">Open for placements</p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">{form.is_active ? 'New students can be placed here.' : 'Closed. No new students will be placed.'}</p>
            </div>
            <button type="button" role="switch" aria-checked={!!form.is_active} aria-label="Open for placements" onClick={() => set({ is_active: !form.is_active })}
              className={`flex h-[30px] w-[50px] flex-none rounded-full p-[3px] transition-colors ${form.is_active ? 'justify-end bg-accent' : 'justify-start bg-ink-300'}`}>
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </button>
          </div>

          {!isNew && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onRecipients(office!)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface text-[13.5px] font-semibold text-ink-900 hover:bg-ink-50">
                <Users className="h-[18px] w-[18px]" /> Recipients
              </button>
              <button type="button" onClick={() => onQr(office!)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface text-[13.5px] font-semibold text-ink-900 hover:bg-ink-50">
                <QrCode className="h-[18px] w-[18px]" /> Office QR
              </button>
            </div>
          )}

          {/* More details */}
          <section className="rounded-xl border border-ink-200">
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
                  <span className={labelCls}>Office head <span className="font-normal text-ink-400">(optional)</span></span>
                  <input value={form.head_name ?? ''} onChange={(e) => set({ head_name: e.target.value })} placeholder="Full name" className={inputCls} />
                </label>
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
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-ink-900/[.06] px-6 py-3.5">
          {!isNew && nextLeft > 0 ? (
            <button type="button" onClick={() => leave(onNext)} className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-200 px-3.5 text-[13px] font-semibold text-ink-700 hover:bg-ink-50">
              Next office <ArrowRight className="h-4 w-4" />
              <span className="text-[11.5px] font-normal text-ink-400">({nextLeft} more)</span>
            </button>
          ) : <span />}
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-bold text-white hover:bg-accent-hover disabled:opacity-50">
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> {saving ? 'Saving…' : isNew ? 'Add office' : 'Save'}
          </button>
        </div>
      </div>
      </div>
    </>
  )
}

/** The fields the office form sends (and compares to detect changes). */
function pickFields(o: Partial<Office>) {
  return {
    name: (o.name ?? '').trim(),
    description: o.description || null,
    head_name: o.head_name || null,
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
type Sort = 'az' | 'space' | 'full'

/**
 * Admin → Offices (layout "SWAP Admin Offices v3"): every office is Ready, Needs setup or Closed.
 * The banner walks the admin through the ones not ready; a card opens the office drawer.
 * New placements are refused server-side in an office that isn't ready (AssignmentService).
 */
export default function AdminOfficesPage() {
  const queryClient = useQueryClient()
  const { notifyError } = useFeedback()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('az')
  // 'new' = the add-office drawer; a number = that office; null = closed.
  const [cur, setCur] = useState<number | 'new' | null>(null)
  const [version, setVersion] = useState(0)
  const [qrView, setQrView] = useState<{ name: string; token: string } | null>(null)
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
  const open = (o: Office) => o.max_recipients - (o.active_recipients ?? 0)
  const list = offices
    .filter((o) => (tab === 'all' || statusOf(o) === tab) && (!q || `${o.name} ${supNames(o)}`.toLowerCase().includes(q)))
    .sort((a, b) => sort === 'space' ? open(b) - open(a)
      : sort === 'full' ? (b.active_recipients ?? 0) / (b.max_recipients || 1) - (a.active_recipients ?? 0) / (a.max_recipients || 1)
        : a.name.localeCompare(b.name))

  // Setup queue: needs setup first, then closed, by name.
  const rank: Record<StatusKey, number> = { setup: 0, off: 1, ready: 2 }
  const needSetup = offices.filter((o) => statusOf(o) === 'setup')
    .sort((a, b) => rank[statusOf(a)] - rank[statusOf(b)] || a.name.localeCompare(b.name))
  const current = typeof cur === 'number' ? offices.find((o) => o.id === cur) ?? null : null
  const nextList = needSetup.filter((o) => o.id !== current?.id)
  const readyPct = counts.all ? Math.round((counts.ready / counts.all) * 100) : 0

  const refresh = async (id: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-offices-list'] }),
      queryClient.invalidateQueries({ queryKey: ['all-supervisors'] }),
    ])
    setVersion((v) => v + 1)
    if (id) setCur(id)
  }

  const TABS: [Tab, string][] = [['all', 'All'], ['setup', 'Needs setup'], ['ready', 'Ready'], ['off', 'Closed']]

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-.02em] text-ink-950">Offices</h1>
          <p className="mt-1 text-[14px] text-ink-500">Where recipients are placed to work. Click an office to set it up or change it.</p>
          {totalOffices > offices.length && (
            <p className="mt-1 text-[12.5px] text-warning-700">Showing the first {offices.length} of {totalOffices} offices. Use search to find the rest.</p>
          )}
        </div>
        <button type="button" onClick={() => setCur('new')}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-[18px] text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(23,129,95,.25)] hover:bg-accent-hover">
          <Store className="h-5 w-5" /> Add office
        </button>
      </div>

      {/* Setup banner */}
      {needSetup.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-[18px] bg-accent-deep px-5 py-[18px] text-white"
          style={{ backgroundImage: 'radial-gradient(120% 160% at 100% 0%, rgba(221,187,56,.28), transparent 50%)' }}>
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-white/[.12] text-gold-accent">
            <Construction className="h-6 w-6" />
          </span>
          <div className="min-w-[240px] flex-1">
            <p className="text-[16px] font-bold">{needSetup.length} {needSetup.length === 1 ? "office isn't" : "offices aren't"} ready for students yet</p>
            <p className="mt-0.5 text-[13px] text-white/75">Students can&apos;t be placed in an office until it has a supervisor, a location and a clock-in area.</p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="h-1.5 max-w-[320px] flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gold-accent" style={{ width: `${readyPct}%` }} />
              </div>
              <span className="text-[12.5px] font-semibold text-white/85">{counts.ready} of {counts.all} ready</span>
            </div>
          </div>
          <button type="button" onClick={() => setCur(needSetup[0].id)}
            className="btn-gold flex h-11 items-center gap-2 rounded-xl px-[18px] text-[14px] font-extrabold">
            Start setup <ArrowRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-[13px] border border-ink-900/[.08] bg-surface p-1">
          {TABS.map(([k, label]) => {
            const on = tab === k
            return (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={on}
                className={`flex h-9 flex-none items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold ${on ? 'bg-accent-deep text-white' : 'text-ink-600 hover:text-ink-900'}`}>
                {label}<span className="text-[11.5px] font-bold opacity-65">{counts[k]}</span>
              </button>
            )
          })}
        </div>
        <div className="flex h-[46px] min-w-[220px] flex-1 items-center gap-2 rounded-[13px] border border-ink-900/10 bg-surface px-3.5">
          <Search className="h-5 w-5 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search office or supervisor" aria-label="Search offices"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-ink-950 focus:outline-none" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-ink-400"><X className="h-4 w-4" /></button>}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort offices"
          className="h-[46px] cursor-pointer rounded-[13px] border border-ink-900/10 bg-surface px-3 text-[13.5px] font-semibold text-ink-700 focus:border-accent focus:outline-none">
          <option value="az">Name A–Z</option>
          <option value="space">Most open slots</option>
          <option value="full">Fullest first</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-48 animate-pulse rounded-[18px] bg-ink-200/50" />)}
        </div>
      ) : list.length === 0 ? (
        <div className={`${CARD} px-5 py-12 text-center text-[14px] text-ink-500`}>
          {offices.length === 0 ? 'No offices yet. Add your first host office.' : 'No offices match. Try another search or tab.'}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
          {list.map((o) => {
            const st = statusOf(o)
            const [bg, fg] = palette(o.id)
            const filled = o.active_recipients ?? 0
            const cap = o.max_recipients || 0
            const ratio = cap ? filled / cap : 0
            const bar = ratio >= 1 ? 'var(--color-red-accent)' : ratio >= 0.8 ? 'var(--color-gold-accent)' : 'var(--color-accent)'
            const sups = supNames(o)
            return (
              <div key={o.id} role="button" tabIndex={0} onClick={() => setCur(o.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setCur(o.id) }}
                className={`${CARD} flex cursor-pointer flex-col gap-3.5 p-[18px] transition-shadow hover:border-accent hover:shadow-[0_8px_24px_rgba(20,40,30,.08)] ${st === 'off' ? 'opacity-75' : ''}`}>
                <div className="flex items-start gap-3">
                  <OfficeLogo office={o} bg={st === 'off' ? 'var(--color-ink-100)' : bg} fg={st === 'off' ? 'var(--text-ink-400)' : fg} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold leading-snug text-ink-950">{o.name}</p>
                    <p className={`mt-0.5 flex items-center gap-1 text-[12.5px] ${sups ? 'text-ink-600' : 'text-ink-350'}`}>
                      <UserIcon className="h-3.5 w-3.5 flex-none" /><span className="truncate">{sups || 'No supervisor yet'}</span>
                    </p>
                  </div>
                  <StatusPill k={st} small />
                </div>

                {st === 'ready' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[13px] text-ink-700">
                      <span><b className="text-ink-950">{filled}</b> of {cap} students placed</span>
                      <span className="font-semibold text-accent-strong">{Math.max(0, cap - filled)} open</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, background: bar }} />
                    </div>
                  </div>
                )}
                {st === 'setup' && (
                  <div className="space-y-2">
                    <p className="text-[12.5px] text-ink-500">Still needs:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingOf(o).map((m) => (
                        <span key={m} className="flex items-center gap-1 rounded-full border border-dashed border-gold-accent/60 bg-gold-50 px-2.5 py-1 text-[12px] font-semibold text-warning-700">
                          <Plus className="h-3.5 w-3.5" />{MISSING_LABEL[m]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {st === 'off' && <p className="text-[13px] text-ink-500">Closed. No new students can be placed here.</p>}

                <div className="mt-auto flex items-center gap-2 border-t border-ink-900/[.05] pt-3">
                  <span className={`flex min-w-0 flex-1 items-center gap-1 text-[12.5px] ${o.location ? 'text-ink-500' : 'text-ink-350'}`}>
                    <MapPin className="h-3.5 w-3.5 flex-none" /><span className="truncate">{o.location || 'No location yet'}</span>
                  </span>
                  {st === 'ready' && (
                    <button type="button" title="Office QR" onClick={(e) => { e.stopPropagation(); officeQr.mutate(o) }}
                      className="flex h-[34px] flex-none items-center gap-1 rounded-[10px] border border-ink-200 bg-surface px-2.5 text-[12.5px] font-semibold text-ink-700 hover:border-accent hover:text-accent-strong">
                      <QrCode className="h-4 w-4" /> QR
                    </button>
                  )}
                  <span className="flex flex-none items-center text-[12.5px] font-bold text-accent-strong">
                    {st === 'setup' ? 'Set up' : st === 'off' ? 'Open' : 'Manage'}<ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cur !== null && (cur === 'new' || current) && (
        <OfficeDrawer key={`${cur}-${version}`} office={cur === 'new' ? null : current} offices={offices} allSupervisors={allSupervisors}
          nextLeft={nextList.length} onNext={() => nextList[0] && setCur(nextList[0].id)}
          onClose={() => setCur(null)} onSaved={refresh}
          onRecipients={(o) => setViewOffice(o)} onQr={(o) => officeQr.mutate(o)} />
      )}

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
            <div className="flex justify-center">
              <QrDisplay value={`${window.location.origin}/scan?t=${encodeURIComponent(qrView.token)}`} size={220} caption={qrView.name} />
            </div>
            <p className="mt-4 text-center text-xs text-ink-500">
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
