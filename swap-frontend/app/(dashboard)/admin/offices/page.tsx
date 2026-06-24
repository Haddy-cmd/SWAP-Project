'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, QrCode, MapPin, X, Users, UserCog } from 'lucide-react'
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

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function OfficeForm({ initial, onSave, onCancel, loading }: {
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

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm space-y-4">
      <h2 className="font-semibold text-[#1E293B]">{initial?.id ? 'Edit Office' : 'New Office'}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([['name','Name'], ['code','Code'], ['head_name','Head Name'], ['location','Location']] as const).map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">{label}</label>
            <input value={String(form[k] ?? '')} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none" />
          </div>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Max Recipients</label>
        <input type="number" value={form.max_recipients ?? 10} onChange={e => setForm(f => ({ ...f, max_recipients: Number(e.target.value) }))}
          className="w-32 rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none" />
      </div>

      {/* Geofence */}
      <div className="rounded-xl border border-[#EAD9D9] bg-[#FAF7F7] p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-[#1E293B]">
          <input type="checkbox" checked={!!form.geofence_enabled}
            onChange={e => setForm(f => ({ ...f, geofence_enabled: e.target.checked }))}
            className="h-4 w-4 accent-[#7D1A1A]" />
          <MapPin className="h-4 w-4 text-[#7D1A1A]" />
          Enable location geofencing for this office
        </label>
        <p className="text-xs text-[#8A6A6A]">
          When enabled, recipients can only clock in within the radius below and are auto clocked-out if they leave.
        </p>

        {form.geofence_enabled && (
          <>
            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Latitude (-90 to 90)</label>
                <input
                  type="number"
                  step={0.000001}
                  min={-90}
                  max={90}
                  value={lat ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="7.9986"
                  className="w-full rounded-lg border border-[#DCC5C5] bg-white px-2.5 py-1.5 text-xs focus:border-[#7D1A1A] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Longitude (-180 to 180)</label>
                <input
                  type="number"
                  step={0.000001}
                  min={-180}
                  max={180}
                  value={lng ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="124.2928"
                  className="w-full rounded-lg border border-[#DCC5C5] bg-white px-2.5 py-1.5 text-xs focus:border-[#7D1A1A] focus:outline-none"
                />
              </div>
            </div>

            <OfficeMapPicker
              latitude={lat}
              longitude={lng}
              radius={radius}
              onChange={(la, ln, r) => setForm(f => ({ ...f, latitude: la, longitude: ln, radius_meters: r }))}
              onRadiusChange={(r) => setForm(f => ({ ...f, radius_meters: r }))}
            />
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={() => onSave(form)} disabled={loading || (!!form.geofence_enabled && (lat === null || lng === null))}
          className="rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="rounded-xl border border-[#EAD9D9] px-5 py-2.5 text-sm font-semibold text-[#8A6A6A] hover:bg-[#FAF7F7] transition-colors">
          Cancel
        </button>
      </div>
      {!!form.geofence_enabled && (lat === null || lng === null) && (
        <p className="text-xs text-[#E74C3C]">Drop a pin on the map to set the office location before saving.</p>
      )}
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

  // All supervisors, to build the "assign" picker of those not yet tied to an office.
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
  // Supervisors free to assign here: not yet tied to any office.
  const available = (allSupervisors?.data ?? []).filter((s) => s.office_id == null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-[#1E293B]">{office.name}</h2>
            <p className="text-sm text-[#8A6A6A]">Assigned supervisors &amp; recipients</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Supervisors */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-[#1B4F72]" />
            <h3 className="text-sm font-semibold text-[#1E293B]">Supervisors</h3>
            <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#1B4F72]">{supervisors.length}</span>
          </div>

          {supervisors.length === 0 ? (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-[#92400E]">
              This office has no supervisor yet. Each office should have at least one.
            </p>
          ) : (
            <div className="mb-2 space-y-2">
              {supervisors.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#EAD9D9] bg-[#FAF7F7] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{s.name}</p>
                    <p className="text-xs text-[#8A6A6A]">{s.email}</p>
                  </div>
                  <button
                    onClick={() => remove.mutate(s.id)}
                    disabled={remove.isPending}
                    className="rounded-lg border border-[#EAD9D9] px-2.5 py-1 text-xs font-medium text-[#E74C3C] hover:bg-[#FEF0F0] disabled:opacity-50 transition-colors"
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
              className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none"
            >
              <option value="">{available.length ? 'Select an unassigned supervisor…' : 'No unassigned supervisors available'}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
            <button
              onClick={() => pickSupervisor && assign.mutate(Number(pickSupervisor))}
              disabled={!pickSupervisor || assign.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#1B4F72] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2980B9] disabled:opacity-50 transition-colors"
            >
              <UserCog className="h-3.5 w-3.5" />
              Assign
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#7D1A1A]" />
          <h3 className="text-sm font-semibold text-[#1E293B]">Recipients</h3>
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
              <div key={a.id} className="rounded-xl border border-[#EAD9D9] bg-[#FAF7F7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 flex-shrink-0 text-[#7D1A1A]" />
                      <p className="font-semibold text-[#1E293B]">{a.user?.name ?? '—'}</p>
                    </div>
                    <p className="ml-6 text-xs text-[#8A6A6A]">{a.user?.email ?? '—'}</p>
                    <p className="ml-6 mt-1.5 flex items-center gap-1.5 text-xs text-[#8A6A6A]">
                      <UserCog className="h-3.5 w-3.5 flex-shrink-0 text-[#1B4F72]" />
                      Supervisor: <span className="font-medium text-[#1E293B]">{a.supervisor?.name ?? 'Unassigned'}</span>
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-2 ml-6 text-xs text-[#8A6A6A]">
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

export default function AdminOfficesPage() {
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Office | null>(null)
  const [qrView, setQrView] = useState<{ name: string; token: string } | null>(null)
  const [viewOffice, setViewOffice] = useState<Office | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Offices</h1>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors">
          <Plus className="h-4 w-4" />
          Add Office
        </button>
      </div>

      {showNew && (
        <OfficeForm onSave={(d) => create.mutate(d)} onCancel={() => setShowNew(false)} loading={create.isPending} />
      )}

      {editing && (
        <OfficeForm initial={editing} onSave={(d) => update.mutate({ ...editing, ...d })} onCancel={() => setEditing(null)} loading={update.isPending} />
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-14 animate-pulse rounded-xl bg-[#EAD9D9]" />)}</div>
      ) : !offices.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#DCC5C5] py-16 text-center">
          <Building2 className="h-10 w-10 text-[#DCC5C5]" />
          <p className="text-sm font-medium text-[#B09A9A]">No offices yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offices.map((office) => (
            <div
              key={office.id}
              onClick={() => setViewOffice(office)}
              className="cursor-pointer rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-[#DCC5C5]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1E293B]">{office.name}</p>
                  <p className="text-xs text-[#8A6A6A]">{office.code}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(office) }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAD9D9] text-[#8A6A6A] hover:bg-[#FAF7F7] transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {office.head_name && <p className="mt-2 text-xs text-[#8A6A6A]">Head: {office.head_name}</p>}
              {office.location && <p className="text-xs text-[#8A6A6A]">Location: {office.location}</p>}
              <p className="mt-2 text-xs font-medium text-[#7D1A1A]">Max: {office.max_recipients} recipients</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  office.is_active ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
                }`}>{office.is_active ? 'Active' : 'Inactive'}</span>
                {office.geofence_enabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#1B4F72]">
                    <MapPin className="h-3 w-3" /> Geofenced · {office.radius_meters ?? 100}m
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  office.supervisors_count ? 'bg-[#EFF6FF] text-[#1B4F72]' : 'bg-amber-50 text-[#92400E]'
                }`}>
                  <UserCog className="h-3 w-3" />
                  {office.supervisors_count
                    ? `${office.supervisors_count} supervisor${office.supervisors_count > 1 ? 's' : ''}`
                    : 'No supervisor'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setViewOffice(office) }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-semibold text-[#1B4F72] hover:bg-[#EBF5FB] transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  Recipients
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); officeQr.mutate(office) }}
                  disabled={officeQr.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-semibold text-[#7D1A1A] hover:bg-[#FEF0F0] disabled:opacity-50 transition-colors"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Office QR
                </button>
              </div>
            </div>
          ))}
        </div>
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
