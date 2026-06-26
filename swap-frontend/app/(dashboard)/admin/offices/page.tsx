'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Pencil, QrCode, MapPin, X, Users, UserCog, Copy, Check,
  Search, ChevronDown,
} from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { adminApi } from '@/lib/api/admin.api'
import { QrDisplay } from '@/components/attendance/QrDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatHours } from '@/lib/utils/formatHours'
import type { Office } from '@/types/assignment.types'

const OfficeMapPicker = dynamic(() => import('@/components/admin/OfficeMapPicker'), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-[#EAD9D9]" />,
})

// Soft icon backgrounds, mirrored from the mockup (bg / fg pairs).
const PALETTE: [string, string][] = [
  ['#EAF1F7', '#1F4E6B'],
  ['#FBF3E2', '#B8860B'],
  ['#EAF5EC', '#4E9657'],
  ['#F1ECF7', '#6B4E9A'],
  ['#EAF1F7', '#3B7FB5'],
  ['#FBEAEC', '#7C1B26'],
  ['#F7EDE8', '#C0562F'],
  ['#EAF5EC', '#2C7A57'],
]
const palette = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Per-office logo. Looks for a deploy-time image at `/public/offices/{code}.png`
 * (case-insensitive). Drop a file there to replace the placeholder — no code
 * change needed. Falls back to a tinted building monogram when absent/broken.
 */
function OfficeLogo({ office, bg, fg, size = 44 }: { office: Office; bg: string; fg: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const code = (office.code ?? '').trim().toLowerCase()
  const showImage = !!code && !broken

  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-xl"
      style={{ width: size, height: size, background: showImage ? '#FFFFFF' : bg, color: fg, border: showImage ? '1px solid #EFE5DA' : 'none' }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/offices/${code}.png`}
          alt={`${office.name} logo`}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <Building2 style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  )
}

/** A read-only value with a copy-to-clipboard button — manual fallback when the QR won't scan. */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-[#DCC5C5] bg-[#FAF7F7] px-2.5 py-1.5 text-xs font-mono text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none"
        />
        <button
          onClick={copy}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#EAD9D9] px-2.5 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#27AE60]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3.5 py-2.5 text-sm text-[#2B1E1B] placeholder:text-[#B7A99F] focus:border-[#7C1B26] focus:outline-none focus:ring-2 focus:ring-[#7C1B26]/10'
const labelCls = 'mb-1.5 block text-[12.5px] font-semibold text-[#5A4A45]'

function OfficeFormModal({ initial, onSave, onCancel, loading }: {
  initial?: Partial<Office>
  onSave: (data: Partial<Office>) => void
  onCancel: () => void
  loading?: boolean
}) {
  const [form, setForm] = useState<Partial<Office>>({
    name: '', code: '', description: '', head_name: '', location: '', max_recipients: 10, is_active: true,
    geofence_enabled: false, radius_meters: 100,
    ...initial,
  })

  const lat = toNum(form.latitude)
  const lng = toNum(form.longitude)
  const radius = form.radius_meters ?? 100
  const geoInvalid = !!form.geofence_enabled && (lat === null || lng === null)
  const editing = !!initial?.id

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#280C10]/45 p-4 sm:p-6" onClick={onCancel}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_rgba(40,8,12,.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE5DA] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#FBEAEC] text-[#7C1B26]">
              <Building2 className="h-[21px] w-[21px]" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-[#241715]">{editing ? 'Edit Office' : 'Add Office'}</p>
              <p className="text-[12.5px] text-[#8A7A73]">{editing ? 'Update host office details' : 'Register a new host office'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-[#B79B7E] hover:text-[#7C1B26] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Office Name</label>
              <input value={String(form.name ?? '')} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. University Registrar" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Code</label>
              <input value={String(form.code ?? '')} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. REG" className={inputCls} />
              <p className="mt-1 text-[11px] text-[#A38A82]">Logo file: <span className="font-mono">/offices/{(form.code ?? '').trim().toLowerCase() || 'code'}.png</span></p>
            </div>
            <div>
              <label className={labelCls}>Office Head</label>
              <input value={String(form.head_name ?? '')} onChange={(e) => setForm((f) => ({ ...f, head_name: e.target.value }))}
                placeholder="Full name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={String(form.location ?? '')} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Building, floor" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Capacity (max recipients)</label>
              <input type="number" min={1} value={form.max_recipients ?? 10}
                onChange={(e) => setForm((f) => ({ ...f, max_recipients: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3.5 py-3 text-sm font-medium text-[#2B1E1B]">
            <input type="checkbox" checked={!!form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 accent-[#7C1B26]" />
            Office is active and accepting recipients
          </label>

          {/* Geofence */}
          <div className="space-y-3 rounded-xl border border-[#EADFD4] bg-[#FBF7F2] p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-[#2B1E1B]">
              <input type="checkbox" checked={!!form.geofence_enabled}
                onChange={(e) => setForm((f) => ({ ...f, geofence_enabled: e.target.checked }))}
                className="h-4 w-4 accent-[#7C1B26]" />
              <MapPin className="h-4 w-4 text-[#7C1B26]" />
              Enable location geofencing for this office
            </label>
            <p className="text-xs text-[#8A7A73]">
              When enabled, recipients can only clock in within the radius below and are auto clocked-out if they leave.
            </p>

            {form.geofence_enabled && (
              <>
                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8A7A73]">Latitude (-90 to 90)</label>
                    <input type="number" step={0.000001} min={-90} max={90} value={lat ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      placeholder="7.9986"
                      className="w-full rounded-lg border border-[#EADFD4] bg-white px-2.5 py-1.5 text-xs focus:border-[#7C1B26] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8A7A73]">Longitude (-180 to 180)</label>
                    <input type="number" step={0.000001} min={-180} max={180} value={lng ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      placeholder="124.2928"
                      className="w-full rounded-lg border border-[#EADFD4] bg-white px-2.5 py-1.5 text-xs focus:border-[#7C1B26] focus:outline-none" />
                  </div>
                </div>

                <OfficeMapPicker
                  latitude={lat}
                  longitude={lng}
                  radius={radius}
                  onChange={(la, ln, r) => setForm((f) => ({ ...f, latitude: la, longitude: ln, radius_meters: r }))}
                  onRadiusChange={(r) => setForm((f) => ({ ...f, radius_meters: r }))}
                />
              </>
            )}
          </div>

          {geoInvalid && (
            <p className="text-xs text-[#C0392B]">Drop a pin on the map to set the office location before saving.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[#EFE5DA] bg-[#FCF8F3] px-6 py-4">
          <button onClick={onCancel}
            className="h-11 rounded-xl border border-[#E7D9C9] bg-white px-5 text-sm font-semibold text-[#7A6A63] hover:bg-[#FBF7F2] transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={loading || geoInvalid}
            className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,.26)] transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
            {loading ? 'Saving…' : editing ? 'Save Changes' : 'Create Office'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OfficeRecipientsModal({ office, onClose }: { office: Office; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [pickSupervisor, setPickSupervisor] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['office-assignments', office.id],
    queryFn: () => assignmentsApi.getAssignments({ office_id: String(office.id) }),
  })

  const { data: officeSupervisors } = useQuery({
    queryKey: ['office-supervisors', office.id],
    queryFn: () => assignmentsApi.getOfficeSupervisors(office.id),
  })

  const { data: allSupervisors } = useQuery({
    queryKey: ['all-supervisors'],
    queryFn: () => adminApi.getUsers({ role: 'supervisor' }),
  })

  const assign = useMutation({
    mutationFn: (supervisorId: number) => assignmentsApi.assignSupervisorToOffice(office.id, supervisorId),
    onSuccess: () => {
      setPickSupervisor('')
      queryClient.invalidateQueries({ queryKey: ['office-supervisors', office.id] })
      queryClient.invalidateQueries({ queryKey: ['all-supervisors'] })
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] })
    },
  })

  const remove = useMutation({
    mutationFn: (supervisorId: number) => assignmentsApi.removeSupervisorFromOffice(office.id, supervisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-supervisors', office.id] })
      queryClient.invalidateQueries({ queryKey: ['all-supervisors'] })
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] })
    },
  })

  const assignments = data?.data ?? []
  const supervisors = officeSupervisors ?? []
  const available = (allSupervisors?.data ?? []).filter((s) => s.office_id == null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#241715]">{office.name}</h2>
            <p className="text-sm text-[#8A7A73]">Assigned supervisors &amp; recipients</p>
          </div>
          <button onClick={onClose} className="text-[#B79B7E] hover:text-[#7C1B26] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Supervisors */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-[#6B4E9A]" />
            <h3 className="text-sm font-semibold text-[#241715]">Supervisors</h3>
            <span className="rounded-full bg-[#F1ECF7] px-2 py-0.5 text-xs font-medium text-[#6B4E9A]">{supervisors.length}</span>
          </div>

          {supervisors.length === 0 ? (
            <p className="mb-2 rounded-lg border border-[#F6E0BE] bg-[#FFF7ED] px-3 py-2 text-xs font-medium text-[#92400E]">
              This office has no supervisor yet. Each office should have at least one.
            </p>
          ) : (
            <div className="mb-2 space-y-2">
              {supervisors.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#241715]">{s.name}</p>
                    <p className="text-xs text-[#8A7A73]">{s.email}</p>
                  </div>
                  <button
                    onClick={() => remove.mutate(s.id)}
                    disabled={remove.isPending}
                    className="rounded-lg border border-[#EADFD4] px-2.5 py-1 text-xs font-medium text-[#C0392B] hover:bg-[#FEF0F0] disabled:opacity-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={pickSupervisor}
              onChange={(e) => setPickSupervisor(e.target.value)}
              className="flex-1 rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm focus:border-[#7C1B26] focus:outline-none"
            >
              <option value="">{available.length ? 'Select an unassigned supervisor…' : 'No unassigned supervisors available'}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
            <button
              onClick={() => pickSupervisor && assign.mutate(Number(pickSupervisor))}
              disabled={!pickSupervisor || assign.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#7C1B26] px-3 py-2 text-xs font-semibold text-white hover:bg-[#86202E] disabled:opacity-50 transition-colors"
            >
              <UserCog className="h-3.5 w-3.5" />
              Assign
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#7C1B26]" />
          <h3 className="text-sm font-semibold text-[#241715]">Recipients</h3>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-[#EAD9D9]" />)}</div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-9 w-9 text-[#DCC5C5]" />
            <p className="text-sm font-medium text-[#B09A9A]">No recipients assigned to this office yet.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-xl border border-[#EADFD4] bg-[#FBF7F2] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 flex-shrink-0 text-[#7C1B26]" />
                      <p className="font-semibold text-[#241715]">{a.user?.name ?? '—'}</p>
                    </div>
                    <p className="ml-6 text-xs text-[#8A7A73]">{a.user?.email ?? '—'}</p>
                    <p className="ml-6 mt-1.5 flex items-center gap-1.5 text-xs text-[#8A7A73]">
                      <UserCog className="h-3.5 w-3.5 flex-shrink-0 text-[#6B4E9A]" />
                      Supervisor: <span className="font-medium text-[#241715]">{a.supervisor?.name ?? 'Unassigned'}</span>
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-2 ml-6 text-xs text-[#8A7A73]">
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

type FilterKey = 'All' | 'Active' | 'Has space'
type SortKey = 'Name' | 'Capacity' | 'Open slots'

export default function AdminOfficesPage() {
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Office | null>(null)
  const [qrView, setQrView] = useState<{ name: string; token: string } | null>(null)
  const [viewOffice, setViewOffice] = useState<Office | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('All')
  const [sort, setSort] = useState<SortKey>('Name')
  const [sortOpen, setSortOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-offices'],
    queryFn: () => assignmentsApi.getOffices(),
  })

  const create = useMutation({
    mutationFn: (d: Partial<Office>) => assignmentsApi.createOffice(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-offices'] }); setShowNew(false) },
  })

  const update = useMutation({
    mutationFn: (d: Partial<Office>) => assignmentsApi.updateOffice(d.id!, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-offices'] }); setEditing(null) },
  })

  const officeQr = useMutation({
    mutationFn: (office: Office) => assignmentsApi.generateOfficeQr(office.id).then((r) => ({ name: office.name, token: r.data.qr_code })),
    onSuccess: (res) => setQrView(res),
  })

  const offices = data?.data ?? []
  const totalCap = offices.reduce((s, o) => s + (o.max_recipients || 0), 0)

  const q = search.trim().toLowerCase()
  let list = offices.filter((o) =>
    !q || o.name.toLowerCase().includes(q) || (o.head_name ?? '').toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q))
  if (filter === 'Active') list = list.filter((o) => o.is_active)
  if (filter === 'Has space') list = list.filter((o) => (o.active_recipients ?? 0) < o.max_recipients)
  list = [...list].sort((a, b) => {
    if (sort === 'Capacity') return b.max_recipients - a.max_recipients
    if (sort === 'Open slots') return (b.max_recipients - (b.active_recipients ?? 0)) - (a.max_recipients - (a.active_recipients ?? 0))
    return a.name.localeCompare(b.name)
  })

  const FILTERS: FilterKey[] = ['All', 'Active', 'Has space']
  const SORTS: SortKey[] = ['Name', 'Capacity', 'Open slots']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Host Offices</p>
          <h1 className="font-serif text-3xl font-medium text-[#241715]">Offices</h1>
          <p className="mt-1.5 text-[13.5px] text-[#8A7A73]">
            {offices.length} host office{offices.length === 1 ? '' : 's'} · {totalCap} total recipient capacity
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex h-11 items-center gap-2 self-start rounded-xl px-5 text-sm font-semibold text-[#FFF8F2] shadow-[0_12px_24px_rgba(108,22,32,.26)] transition-opacity hover:opacity-95 sm:self-auto"
          style={{ background: 'linear-gradient(180deg,#86202E,#6C1620)' }}>
          <Plus className="h-[19px] w-[19px]" />
          Add Office
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#B79B7E]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offices by name or head…"
            className="h-11 w-full rounded-xl border border-[#EADFD4] bg-white pl-11 pr-4 text-sm text-[#2B1E1B] placeholder:text-[#B7A99F] focus:border-[#7C1B26] focus:outline-none focus:ring-2 focus:ring-[#7C1B26]/10"
          />
        </div>

        <div className="inline-flex gap-1 rounded-xl bg-[#F1E7DC] p-1">
          {FILTERS.map((f) => {
            const on = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-lg px-4 py-2 text-[12.5px] transition-colors"
                style={{
                  background: on ? '#FFFFFF' : 'transparent',
                  color: on ? '#7C1B26' : '#8A7A73',
                  fontWeight: on ? 600 : 500,
                  boxShadow: on ? '0 1px 3px rgba(60,30,25,.08)' : 'none',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <button
            onClick={() => setSortOpen((s) => !s)}
            className="flex h-11 items-center gap-2 rounded-xl border border-[#EADFD4] bg-white px-4 text-[13px] font-semibold text-[#2B1E1B]"
          >
            Sort: {sort}
            <ChevronDown className="h-4 w-4 text-[#B79B7E]" />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-[52px] z-30 w-48 rounded-xl border border-[#EADFD4] bg-white p-1.5 shadow-[0_18px_40px_rgba(58,24,20,.18)]">
                {SORTS.map((s) => {
                  const on = sort === s
                  return (
                    <button
                      key={s}
                      onClick={() => { setSort(s); setSortOpen(false) }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-[#2B1E1B]"
                      style={{ background: on ? '#FBF3E7' : 'transparent', fontWeight: on ? 700 : 500 }}
                    >
                      {s}
                      {on && <Check className="h-[17px] w-[17px] text-[#7C1B26]" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-64 animate-pulse rounded-[15px] bg-[#EAD9D9]/50" />)}
        </div>
      ) : offices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[15px] border border-dashed border-[#E0D2C4] bg-white py-16 text-center">
          <Building2 className="h-10 w-10 text-[#DCC5C5]" />
          <p className="text-sm font-medium text-[#B09A9A]">No offices yet — add your first host office.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-[15px] border border-dashed border-[#E0D2C4] bg-white py-12 text-center text-sm text-[#A38A82]">
          No offices match your search or filter.
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((office) => {
            const [bg, fg] = palette(office.id)
            const filled = office.active_recipients ?? 0
            const max = office.max_recipients || 0
            const ratio = max ? filled / max : 0
            const full = max > 0 && filled >= max
            const barColor = full ? '#C0562F' : ratio >= 0.75 ? '#D8A12B' : '#4E9657'
            const pct = Math.min(100, Math.round(ratio * 100))

            return (
              <div key={office.id} className="rounded-[15px] border border-[#EFE5DA] bg-white p-5 shadow-[0_2px_8px_rgba(60,30,25,.04)]">
                {/* Header: logo + name + edit */}
                <div className="mb-3.5 flex items-start gap-3">
                  <OfficeLogo office={office} bg={bg} fg={fg} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-tight text-[#241715]">{office.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A38A82]">{office.code}</p>
                  </div>
                  <button
                    onClick={() => setEditing(office)}
                    title="Edit office"
                    className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-[#EADFD4] bg-[#FBF7F2] text-[#7A6A63] hover:bg-[#F4ECE1] transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {/* Head + location */}
                <div className="mb-3.5 space-y-1 text-[12.5px] leading-[1.7] text-[#7A6A63]">
                  {office.head_name && (
                    <div className="flex items-center gap-1.5">
                      <UserCog className="h-4 w-4 flex-none text-[#B79B7E]" />
                      <span className="truncate">{office.head_name}</span>
                    </div>
                  )}
                  {office.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 flex-none text-[#B79B7E]" />
                      <span className="truncate">{office.location}</span>
                    </div>
                  )}
                </div>

                {/* Capacity */}
                <div className="mb-3.5">
                  <div className="mb-1.5 flex justify-between text-[11.5px] font-semibold">
                    <span className="text-[#5A4A45]">Capacity</span>
                    <span style={{ color: barColor }}>{filled} / {max} · {full ? 'Full' : `${Math.max(0, max - filled)} open`}</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-[5px] bg-[#F1E7DC]">
                    <div className="h-full rounded-[5px]" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>

                {/* Status chips */}
                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] font-bold"
                    style={office.is_active
                      ? { color: '#2C5A33', background: '#EAF5EC' }
                      : { color: '#8A7A73', background: '#F1E7DC' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: office.is_active ? '#4E9657' : '#B7A99F' }} />
                    {office.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {office.geofence_enabled && (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#F4ECE1] px-2.5 py-1 text-[11px] font-semibold text-[#5A4A45]">
                      <MapPin className="h-3.5 w-3.5 text-[#A9823C]" />
                      {office.radius_meters ?? 100}m geofence
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] font-semibold"
                    style={office.supervisors_count
                      ? { color: '#5A4A45', background: '#F4ECE1' }
                      : { color: '#92400E', background: '#FFF7ED' }}
                  >
                    <UserCog className="h-3.5 w-3.5 text-[#6B4E9A]" />
                    {office.supervisors_count
                      ? `${office.supervisors_count} sup${office.supervisors_count > 1 ? 's' : ''}`
                      : 'No supervisor'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewOffice(office)}
                    className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#EADFD4] bg-[#FBF7F2] text-[12.5px] font-semibold text-[#3F2F2A] hover:bg-[#F4ECE1] transition-colors"
                  >
                    <Users className="h-4 w-4 text-[#7C1B26]" />
                    Recipients
                  </button>
                  <button
                    onClick={() => officeQr.mutate(office)}
                    disabled={officeQr.isPending}
                    className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#EADFD4] bg-[#FBF7F2] text-[12.5px] font-semibold text-[#3F2F2A] hover:bg-[#F4ECE1] disabled:opacity-50 transition-colors"
                  >
                    <QrCode className="h-4 w-4 text-[#A9823C]" />
                    Office QR
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showNew && (
        <OfficeFormModal onSave={(d) => create.mutate(d)} onCancel={() => setShowNew(false)} loading={create.isPending} />
      )}
      {editing && (
        <OfficeFormModal initial={editing} onSave={(d) => update.mutate({ ...editing, ...d })} onCancel={() => setEditing(null)} loading={update.isPending} />
      )}

      {/* Office QR modal */}
      {qrView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQrView(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-semibold text-[#1E293B]">Office QR — {qrView.name}</h2>
              <button onClick={() => setQrView(null)} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center">
              <QrDisplay
                value={`${window.location.origin}/scan?t=${encodeURIComponent(qrView.token)}`}
                size={220}
                caption={qrView.name}
              />
            </div>
            <p className="mt-4 text-center text-xs text-[#8A6A6A]">
              Print and post this at the office entrance. Recipients scan it with their
              phone camera to clock in automatically — no need to open the portal first.
            </p>

            <div className="mt-4 space-y-3 border-t border-[#EAD9D9] pt-4">
              <p className="text-xs font-medium text-[#8A6A6A]">
                Manual fallback (if the camera won&apos;t scan):
              </p>
              <CopyField label="Scan link — open in a phone browser" value={`${window.location.origin}/scan?t=${encodeURIComponent(qrView.token)}`} />
              <CopyField label="QR token — paste in Attendance → QR Token" value={qrView.token} />
            </div>
          </div>
        </div>
      )}

      {/* Office recipients & supervisors modal */}
      {viewOffice && (
        <OfficeRecipientsModal office={viewOffice} onClose={() => setViewOffice(null)} />
      )}
    </div>
  )
}
