'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Building2, X, MapPin, Sparkles, Target,
  ChevronRight, Check, CheckCircle2, AlertTriangle, Users,
} from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { adminApi } from '@/lib/api/admin.api'
import { applicationsApi } from '@/lib/api/applications.api'
import { ManualHoursModal, RequiredHoursModal } from '@/components/attendance/HoursModals'
import type { Application } from '@/types/application.types'
import type { Assignment } from '@/types/assignment.types'

// Soft avatar palettes, mirrored from the mockup (bg / fg pairs).
const AV: [string, string][] = [
  ['#FBEAEC', '#7C1B26'],
  ['#EAF1F7', '#3B7FB5'],
  ['#EAF5EC', '#4E9657'],
  ['#FBF3E2', '#B8860B'],
  ['#F1ECF7', '#6B4E9A'],
  ['#F7EDE8', '#C0562F'],
]
const av = (i: number) => AV[((i % AV.length) + AV.length) % AV.length]
const initials = (n?: string) =>
  (n ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'
const today = () => new Date().toISOString().slice(0, 10)

function StatusPill({ status }: { status: string }) {
  const active = status === 'active'
  return (
    <span
      className="flex-none inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
      style={active ? { background: '#EAF5EC', color: '#2C5A33' } : { background: '#F1F5F9', color: '#64748B' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? '#4E9657' : '#94A3B8' }} />
      {status}
    </span>
  )
}

export default function AdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [assignedSearch, setAssignedSearch] = useState('')
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [editFor, setEditFor] = useState<Assignment | null>(null)
  const [bonusFor, setBonusFor] = useState<Assignment | null>(null)
  const [hoursFor, setHoursFor] = useState<Assignment | null>(null)

  // Inline assign-panel fields
  const [officeId, setOfficeId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [requiredHours, setRequiredHours] = useState('120')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState('')

  // Edit (change office/supervisor) form fields
  const [editOfficeId, setEditOfficeId] = useState('')
  const [editSupervisorId, setEditSupervisorId] = useState('')

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => assignmentsApi.getAssignments(),
  })

  const { data: approvedData } = useQuery({
    queryKey: ['admin-approved-applications'],
    queryFn: () => applicationsApi.adminListApplications({ status: 'approved' }),
  })

  const { data: offices } = useQuery({
    queryKey: ['admin-offices-list'],
    queryFn: () => assignmentsApi.getOffices(),
  })

  const { data: supervisors } = useQuery({
    queryKey: ['admin-supervisors-list'],
    queryFn: () => adminApi.getUsers({ role: 'supervisor' }),
  })

  const assignments = assignmentsData?.data ?? []
  const assignedUserIds = new Set(assignments.map((a) => a.user_id))

  // Approved applicants who do not yet have an assignment
  const pending = (approvedData?.data ?? []).filter((app) => !assignedUserIds.has(app.user_id))

  const q = search.trim().toLowerCase()
  const matches = (name?: string, email?: string) =>
    !q || (name ?? '').toLowerCase().includes(q) || (email ?? '').toLowerCase().includes(q)

  const filteredPending = pending.filter((app) => matches(app.user?.name, app.user?.email))
  const filteredAssignments = assignments.filter((a) => matches(a.user?.name, a.user?.email))

  // The recipient currently loaded into the assign panel.
  const selected: Application | null =
    (selectedAppId != null ? pending.find((p) => p.id === selectedAppId) : null) ?? filteredPending[0] ?? null

  // Supervisors belonging to a given office (supervisor → one office).
  const supervisorsFor = (oid: string) =>
    (supervisors?.data ?? []).filter((s) => oid !== '' && String(s.office_id ?? '') === oid)

  // Picking an office auto-selects its supervisor when there's exactly one; otherwise clears it.
  function pickOffice(oid: string, setOffice: (v: string) => void, setSupervisor: (v: string) => void) {
    setOffice(oid)
    const sups = supervisorsFor(oid)
    setSupervisor(sups.length === 1 ? String(sups[0].id) : '')
  }

  function selectRecipient(app: Application) {
    setSelectedAppId(app.id)
    setOfficeId('')
    setSupervisorId('')
    setRequiredHours('120')
    setStartDate(today())
    setEndDate('')
    setToast('')
  }

  const addBonus = useMutation({
    mutationFn: (v: { hours: number; date: string; reason: string }) => assignmentsApi.addManualHours(bonusFor!.id, v),
    onSuccess: () => {
      setBonusFor(null)
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
    },
  })

  const setReq = useMutation({
    mutationFn: (hours: number) => assignmentsApi.requestRequiredHours(hoursFor!.id, hours),
    onSuccess: () => {
      setHoursFor(null)
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
    },
  })

  const assign = useMutation({
    mutationFn: () =>
      assignmentsApi.createAssignment({
        user_id: selected!.user_id,
        office_id: Number(officeId),
        supervisor_id: Number(supervisorId),
        academic_year: selected!.academic_year,
        semester: selected!.semester,
        required_hours: Number(requiredHours),
        start_date: startDate,
        ...(endDate && { end_date: endDate }),
      }),
    onSuccess: () => {
      const name = selected?.user?.name ?? 'Recipient'
      const oName = offices?.data.find((o) => String(o.id) === officeId)?.name ?? 'office'
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-approved-applications'] })
      setSelectedAppId(null)
      setOfficeId('')
      setSupervisorId('')
      setStartDate(today())
      setEndDate('')
      setToast(`${name} assigned to ${oName}.`)
    },
  })

  const edit = useMutation({
    mutationFn: () =>
      assignmentsApi.updateAssignment(editFor!.id, {
        office_id: Number(editOfficeId),
        supervisor_id: Number(editSupervisorId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      setEditFor(null)
    },
  })

  function openEdit(a: Assignment) {
    setEditFor(a)
    setEditOfficeId(String(a.office_id))
    setEditSupervisorId(String(a.supervisor_id))
  }

  const panelSups = supervisorsFor(officeId)
  const canAssign =
    !!selected && !!officeId && !!supervisorId && !!startDate && !!requiredHours && !assign.isPending

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9823C]">Office Placement</p>
          <h1 className="font-serif text-3xl font-medium text-[#241715]">Assignments</h1>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#B79B7E]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipients…"
            className="h-11 w-full rounded-xl border border-[#EADFD4] bg-white pl-11 pr-4 text-sm text-[#2B1E1B] placeholder:text-[#B7A99F] focus:border-[#7C1B26] focus:outline-none focus:ring-2 focus:ring-[#7C1B26]/10"
          />
        </div>
      </div>

      {/* Assign workspace: pending queue (left) + sticky assign panel (right) */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Pending queue */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A6B12]">
            Pending Assignment
            <span className="rounded-full bg-[#F4E4BC] px-2.5 py-0.5 text-[11px] text-[#8A5E10]">{filteredPending.length}</span>
          </div>

          {filteredPending.length === 0 ? (
            <div className="rounded-[13px] border border-dashed border-[#E0D2C4] bg-white px-6 py-10 text-center text-sm text-[#A38A82]">
              {q ? <>No pending recipients match “{search}”.</> : 'No approved applicants awaiting assignment.'}
            </div>
          ) : (
            filteredPending.map((app, i) => {
              const [bg, fg] = av(i)
              const active = selected?.id === app.id
              return (
                <button
                  key={app.id}
                  onClick={() => selectRecipient(app)}
                  className="flex items-center gap-3.5 rounded-[13px] border bg-white px-4 py-3 text-left transition-shadow"
                  style={{
                    borderColor: active ? '#7C1B26' : '#EFE5DA',
                    boxShadow: active ? '0 6px 18px rgba(108,22,32,.14)' : '0 2px 8px rgba(60,30,25,.04)',
                  }}
                >
                  <span
                    className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] text-sm font-bold"
                    style={{ background: bg, color: fg }}
                  >
                    {initials(app.user?.name)}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[14.5px] font-semibold text-[#241715]">{app.user?.name ?? '—'}</span>
                    <span className="block truncate text-xs text-[#A38A82]">{app.user?.email ?? '—'}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap text-[11.5px] text-[#8A7A73]">{app.academic_year} · {app.semester}</span>
                    <ChevronRight className="h-[18px] w-[18px]" style={{ color: active ? '#7C1B26' : '#CBB9AC' }} />
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Assign panel */}
        <div className="overflow-hidden rounded-2xl border border-[#EFE5DA] bg-white shadow-[0_8px_24px_rgba(60,30,25,.08)] lg:sticky lg:top-4">
          {/* Maroon header */}
          <div className="px-6 py-5 text-[#FBEFE0]" style={{ background: 'linear-gradient(150deg,#7C1B26,#530F17)' }}>
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#F3D9A0]/80">Assigning</p>
            {selected ? (
              <div className="flex items-center gap-3">
                <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-xl border border-[#F3D9A0]/40 bg-[#F3D9A0]/20 text-[15px] font-bold text-[#F3D9A0]">
                  {initials(selected.user?.name)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[15.5px] font-bold text-[#FFF8EE]">{selected.user?.name ?? '—'}</p>
                  <p className="text-[11.5px] text-[#FBEFE0]/75">{selected.academic_year} · {selected.semester}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#FBEFE0]/80">No recipient selected.</p>
            )}
          </div>

          {selected ? (
            <div className="space-y-4 px-6 py-5">
              {/* Office picker */}
              <div>
                <p className="mb-2.5 text-[12.5px] font-semibold text-[#5A4A45]">Select host office</p>
                <div className="flex flex-col gap-2">
                  {(offices?.data ?? []).map((o) => {
                    const on = officeId === String(o.id)
                    const oSups = supervisorsFor(String(o.id))
                    const cap = `${o.active_recipients ?? 0} assigned · cap ${o.max_recipients}`
                    return (
                      <button
                        key={o.id}
                        onClick={() => { pickOffice(String(o.id), setOfficeId, setSupervisorId); setToast('') }}
                        className="flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-left transition-colors"
                        style={{
                          background: on ? '#FBEAEC' : '#FBF7F2',
                          border: on ? '1.5px solid #7C1B26' : '1px solid #EADFD4',
                        }}
                      >
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-white text-[#7C1B26]">
                          <Building2 className="h-[18px] w-[18px]" />
                        </span>
                        <span className="flex-1 leading-tight">
                          <span className="block text-[13px] font-bold text-[#2B1E1B]">{o.name}</span>
                          <span className="block text-[11px] text-[#A38A82]">
                            {cap}{oSups.length === 0 ? ' · no supervisor' : ''}
                          </span>
                        </span>
                        <span
                          className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2"
                          style={{ borderColor: on ? '#7C1B26' : '#CBB9AC', background: on ? '#7C1B26' : 'transparent' }}
                        >
                          {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                  {(offices?.data ?? []).length === 0 && (
                    <p className="rounded-[11px] border border-dashed border-[#E0D2C4] px-3.5 py-4 text-center text-xs text-[#A38A82]">
                      No offices yet — add one on the Offices page.
                    </p>
                  )}
                </div>
              </div>

              {/* Supervisor — auto-paired, or a chooser when an office has several */}
              {officeId && (
                <div className="rounded-[11px] bg-[#FBF7F2] px-3.5 py-3">
                  {panelSups.length === 0 ? (
                    <p className="flex items-center gap-2 text-xs font-medium text-[#B45309]">
                      <AlertTriangle className="h-4 w-4 flex-none" />
                      No supervisor in this office. Assign one on the Offices page first.
                    </p>
                  ) : panelSups.length === 1 ? (
                    <p className="flex items-center gap-2 text-xs font-medium text-[#2C5A33]">
                      <Users className="h-4 w-4 flex-none text-[#4E9657]" />
                      Supervisor: <span className="font-bold">{panelSups[0].name}</span>
                    </p>
                  ) : (
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#5A4A45]">Supervisor</label>
                      <select
                        value={supervisorId}
                        onChange={(e) => setSupervisorId(e.target.value)}
                        className="w-full rounded-lg border border-[#EADFD4] bg-white px-3 py-2 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                      >
                        <option value="">Select supervisor…</option>
                        {panelSups.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Required hours + dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#5A4A45]">Required Hours</label>
                  <input
                    type="number" min={1} max={500} value={requiredHours}
                    onChange={(e) => setRequiredHours(e.target.value)}
                    className="w-full rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#5A4A45]">Start Date</label>
                  <input
                    type="date" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold text-[#5A4A45]">
                    End Date <span className="font-normal text-[#A38A82]">(optional)</span>
                  </label>
                  <input
                    type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm text-[#2B1E1B] focus:border-[#7C1B26] focus:outline-none"
                  />
                </div>
              </div>

              {assign.isError && (
                <p className="text-xs font-medium text-[#C0392B]">Could not create assignment. Check the fields and try again.</p>
              )}

              <button
                onClick={() => assign.mutate()}
                disabled={!canAssign}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#FFF8F2] transition-opacity disabled:cursor-not-allowed"
                style={{
                  background: canAssign ? 'linear-gradient(180deg,#86202E,#6C1620)' : '#C9AFB2',
                  boxShadow: canAssign ? '0 12px 24px rgba(108,22,32,.26)' : 'none',
                }}
              >
                <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
                {assign.isPending ? 'Assigning…' : 'Confirm Assignment'}
              </button>

              {toast && (
                <div className="flex items-center gap-2 rounded-[11px] border border-[#D6EBD8] bg-[#EEF7EF] px-3.5 py-3 text-[12.5px] font-semibold text-[#2C5A33]">
                  <CheckCircle2 className="h-[18px] w-[18px] flex-none text-[#4E9657]" />
                  {toast}
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF7EF]">
                <CheckCircle2 className="h-6 w-6 text-[#4E9657]" />
              </span>
              <p className="text-sm font-semibold text-[#241715]">All caught up</p>
              <p className="mt-1 text-xs text-[#A38A82]">Every approved applicant has been placed in an office.</p>
              {toast && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-[11px] border border-[#D6EBD8] bg-[#EEF7EF] px-3.5 py-3 text-[12.5px] font-semibold text-[#2C5A33]">
                  <CheckCircle2 className="h-[18px] w-[18px] flex-none text-[#4E9657]" />
                  {toast}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assigned recipients */}
      <div>
        <div className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#2C5A33]">
          Assigned Recipients
          <span className="rounded-full bg-[#D6EBD8] px-2.5 py-0.5 text-[11px] text-[#2C5A33]">{filteredAssignments.length}</span>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => <div key={n} className="h-32 animate-pulse rounded-[13px] bg-[#EAD9D9]/50" />)}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="rounded-[13px] border border-dashed border-[#E0D2C4] bg-white px-6 py-10 text-center text-sm text-[#A38A82]">
            {q ? <>No assigned recipients match “{search}”.</> : 'No assignments yet.'}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAssignments.map((a, i) => {
              const [bg, fg] = av(i)
              return (
                <div key={a.id} className="rounded-[13px] border border-[#EFE5DA] bg-white p-4 shadow-[0_2px_8px_rgba(60,30,25,.04)]">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] text-[13px] font-bold"
                      style={{ background: bg, color: fg }}
                    >
                      {initials(a.user?.name)}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-semibold text-[#241715]">{a.user?.name ?? '—'}</p>
                      <p className="flex items-center gap-1.5 text-xs text-[#A38A82]">
                        <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: av(a.office_id)[1] }} />
                        <span className="truncate">{a.office?.name ?? '—'}</span>
                      </p>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F4ECE1] pt-3">
                    <span className="text-xs text-[#8A7A73]">
                      {a.required_hours} hrs required
                      {a.pending_required_hours != null && (
                        <span className="ml-1.5 rounded-full bg-[#FBF3E2] px-2 py-0.5 text-[11px] font-semibold text-[#9A6B12]" title="Awaiting supervisor approval">
                          → {a.pending_required_hours}h pending
                        </span>
                      )}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setBonusFor(a)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#EADFD4] bg-white px-2.5 text-xs font-semibold text-[#A9823C] transition-colors hover:bg-[#FBF7F2]"
                      >
                        <Sparkles className="h-[15px] w-[15px]" /> Bonus
                      </button>
                      <button
                        onClick={() => setHoursFor(a)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#EADFD4] bg-white px-2.5 text-xs font-semibold text-[#3B7FB5] transition-colors hover:bg-[#FBF7F2]"
                      >
                        <Target className="h-[15px] w-[15px]" /> Hours
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#EADFD4] bg-white px-2.5 text-xs font-semibold text-[#7C1B26] transition-colors hover:bg-[#FBF7F2]"
                      >
                        <MapPin className="h-[15px] w-[15px]" /> Change
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Change office / supervisor modal */}
      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditFor(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#241715]">Change Office</h2>
                <p className="text-sm text-[#8A7A73]">{editFor.user?.name} · currently at {editFor.office?.name ?? '—'}</p>
              </div>
              <button onClick={() => setEditFor(null)} className="text-[#A38A82] hover:text-[#C0392B] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A4A45]">Office</label>
                <select value={editOfficeId} onChange={(e) => pickOffice(e.target.value, setEditOfficeId, setEditSupervisorId)}
                  className="w-full rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm focus:border-[#7C1B26] focus:outline-none">
                  <option value="">Select office…</option>
                  {offices?.data.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A4A45]">Supervisor</label>
                <select value={editSupervisorId} onChange={(e) => setEditSupervisorId(e.target.value)}
                  disabled={!editOfficeId || supervisorsFor(editOfficeId).length <= 1}
                  className="w-full rounded-xl border border-[#EADFD4] bg-[#FBF7F2] px-3 py-2 text-sm focus:border-[#7C1B26] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]">
                  <option value="">
                    {!editOfficeId ? 'Select an office first' : supervisorsFor(editOfficeId).length === 0 ? 'No supervisor in this office' : 'Select supervisor…'}
                  </option>
                  {supervisorsFor(editOfficeId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {editOfficeId && supervisorsFor(editOfficeId).length === 0 && (
                  <p className="mt-1 text-xs text-[#C0392B]">Assign a supervisor to this office first (Offices page).</p>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs text-[#8A7A73]">
              The recipient will clock in at the new office&apos;s QR going forward. Hours already rendered are unaffected.
            </p>

            {edit.isError && (
              <p className="mt-2 text-xs text-[#C0392B]">Could not update the assignment. Please try again.</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditFor(null)}
                className="rounded-xl border border-[#EADFD4] px-5 py-2.5 text-sm font-semibold text-[#8A7A73] hover:bg-[#FBF7F2] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => edit.mutate()}
                disabled={edit.isPending || !editOfficeId || !editSupervisorId}
                className="flex items-center gap-2 rounded-xl bg-[#7C1B26] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#86202E] disabled:opacity-50 transition-colors">
                <MapPin className="h-4 w-4" />
                {edit.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bonusFor && (
        <ManualHoursModal
          studentName={bonusFor.user?.name}
          requiresApproval
          isPending={addBonus.isPending}
          error={addBonus.isError ? ((addBonus.error as { message?: string })?.message ?? 'Could not add hours.') : null}
          onClose={() => setBonusFor(null)}
          onSubmit={(v) => addBonus.mutate(v)}
        />
      )}
      {hoursFor && (
        <RequiredHoursModal
          current={hoursFor.required_hours}
          requiresApproval
          isPending={setReq.isPending}
          error={setReq.isError ? ((setReq.error as { message?: string })?.message ?? 'Could not update.') : null}
          onClose={() => setHoursFor(null)}
          onSubmit={(h) => setReq.mutate(h)}
        />
      )}
    </div>
  )
}
