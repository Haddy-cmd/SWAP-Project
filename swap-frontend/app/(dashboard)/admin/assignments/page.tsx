'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Building2, X, MapPin } from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { adminApi } from '@/lib/api/admin.api'
import { applicationsApi } from '@/lib/api/applications.api'
import { QrDisplay } from '@/components/attendance/QrDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Application } from '@/types/application.types'
import type { Assignment } from '@/types/assignment.types'

export default function AdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [qrView, setQrView] = useState<{ id: number; token: string } | null>(null)
  const [search, setSearch] = useState('')
  const [assignFor, setAssignFor] = useState<Application | null>(null)
  const [editFor, setEditFor] = useState<Assignment | null>(null)

  // Assign form fields
  const [officeId, setOfficeId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [requiredHours, setRequiredHours] = useState('120')
  const [startDate, setStartDate] = useState('')
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
    enabled: !!assignFor || !!editFor,
  })

  const { data: supervisors } = useQuery({
    queryKey: ['admin-supervisors-list'],
    queryFn: () => adminApi.getUsers({ role: 'supervisor' }),
    enabled: !!assignFor || !!editFor,
  })

  const regenQr = useMutation({
    mutationFn: (id: number) => assignmentsApi.regenerateQr(id),
    onSuccess: (res, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      setQrView({ id, token: res.data.qr_code })
    },
  })

  const assign = useMutation({
    mutationFn: () =>
      assignmentsApi.createAssignment({
        user_id: assignFor!.user_id,
        office_id: Number(officeId),
        supervisor_id: Number(supervisorId),
        academic_year: assignFor!.academic_year,
        semester: assignFor!.semester,
        required_hours: Number(requiredHours),
        start_date: startDate,
        ...(endDate && { end_date: endDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-approved-applications'] })
      closeModal()
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

  const assignments = assignmentsData?.data ?? []
  const assignedUserIds = new Set(assignments.map((a) => a.user_id))

  // Approved applicants who do not yet have an assignment
  const pending = (approvedData?.data ?? []).filter((app) => !assignedUserIds.has(app.user_id))

  const q = search.trim().toLowerCase()
  const matches = (name?: string, email?: string) =>
    !q || (name ?? '').toLowerCase().includes(q) || (email ?? '').toLowerCase().includes(q)

  const filteredPending = pending.filter((app) => matches(app.user?.name, app.user?.email))
  const filteredAssignments = assignments.filter((a) => matches(a.user?.name, a.user?.email))

  // Supervisors belonging to a given office (supervisor → one office).
  const supervisorsFor = (oid: string) =>
    (supervisors?.data ?? []).filter((s) => oid !== '' && String(s.office_id ?? '') === oid)

  // Picking an office auto-selects its supervisor when there's exactly one; otherwise clears it.
  function pickOffice(oid: string, setOffice: (v: string) => void, setSupervisor: (v: string) => void) {
    setOffice(oid)
    const sups = supervisorsFor(oid)
    setSupervisor(sups.length === 1 ? String(sups[0].id) : '')
  }

  function openModal(app: Application) {
    setAssignFor(app)
    setOfficeId('')
    setSupervisorId('')
    setRequiredHours('120')
    setStartDate('')
    setEndDate('')
  }

  function closeModal() {
    setAssignFor(null)
  }

  function openEdit(a: Assignment) {
    setEditFor(a)
    setEditOfficeId(String(a.office_id))
    setEditSupervisorId(String(a.supervisor_id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Assignments</h1>
      </div>

      {/* Search */}
      <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient name or email…"
            className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pl-9 pr-4 text-sm text-[#1E293B] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/15"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-[#1B4F72] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </form>

      {qrView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQrView(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-semibold text-[#1E293B]">QR Code — Assignment #{qrView.id}</h2>
              <button onClick={() => setQrView(null)} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center">
              <QrDisplay value={qrView.token} size={200} caption={`Assignment #${qrView.id}`} />
            </div>
          </div>
        </div>
      )}

      {/* Pending Assignment — approved applicants without an assignment */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#FFFBEB] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#92400E]">Pending Assignment</h2>
          <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#92400E]">{filteredPending.length}</span>
        </div>
        {!filteredPending.length ? (
          <p className="p-8 text-center text-sm text-[#94A3B8]">No approved applicants awaiting assignment.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Applicant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPending.map((app) => (
                <tr key={app.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#1E293B]">{app.user?.name ?? '—'}</p>
                    <p className="text-xs text-[#94A3B8]">{app.user?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{app.academic_year} — {app.semester}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openModal(app)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#27AE60] px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Assign to Office
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Active Assignments — already assigned */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F0FDF4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#166534]">Assigned Recipients</h2>
          <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-medium text-[#166534]">{filteredAssignments.length}</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(n => <div key={n} className="h-14 animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div>
        ) : !filteredAssignments.length ? (
          <p className="p-8 text-center text-sm text-[#94A3B8]">No assignments yet.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Office</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Req. Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((a) => (
                <tr key={a.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#1E293B]">{a.user?.name ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{a.office?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748B]">{a.required_hours} hrs</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(a)}
                        className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Change Office
                      </button>
                      <button
                        onClick={() => a.qr_code && setQrView({ id: a.id, token: a.qr_code })}
                        disabled={!a.qr_code}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1B4F72] hover:bg-[#EBF5FB] disabled:opacity-40 transition-colors"
                      >
                        View QR
                      </button>
                      <button
                        onClick={() => regenQr.mutate(a.id)}
                        disabled={regenQr.isPending}
                        className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#F39C12] hover:bg-yellow-50 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regen QR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Assign modal */}
      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-[#1E293B]">Assign to Office</h2>
                <p className="text-sm text-[#64748B]">{assignFor.user?.name} · {assignFor.academic_year} — {assignFor.semester}</p>
              </div>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Office</label>
                <select value={officeId} onChange={(e) => pickOffice(e.target.value, setOfficeId, setSupervisorId)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none">
                  <option value="">Select office…</option>
                  {offices?.data.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Supervisor</label>
                <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}
                  disabled={!officeId || supervisorsFor(officeId).length <= 1}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]">
                  <option value="">
                    {!officeId ? 'Select an office first' : supervisorsFor(officeId).length === 0 ? 'No supervisor in this office' : 'Select supervisor…'}
                  </option>
                  {supervisorsFor(officeId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {officeId && supervisorsFor(officeId).length === 0 && (
                  <p className="mt-1 text-xs text-[#E74C3C]">Assign a supervisor to this office first (Offices page).</p>
                )}
                {officeId && supervisorsFor(officeId).length === 1 && (
                  <p className="mt-1 text-xs text-[#27AE60]">Auto-selected the office&apos;s supervisor.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Required Hours</label>
                <input type="number" min={1} max={500} value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">End Date <span className="text-[#94A3B8]">(optional)</span></label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none" />
              </div>
            </div>

            {assign.isError && (
              <p className="mt-3 text-xs text-[#E74C3C]">Could not create assignment. Check the fields and try again.</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeModal}
                className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => assign.mutate()}
                disabled={assign.isPending || !officeId || !supervisorId || !startDate || !requiredHours}
                className="flex items-center gap-2 rounded-xl bg-[#27AE60] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                <Building2 className="h-4 w-4" />
                Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change office / supervisor modal */}
      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditFor(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-[#1E293B]">Change Office</h2>
                <p className="text-sm text-[#64748B]">{editFor.user?.name} · currently at {editFor.office?.name ?? '—'}</p>
              </div>
              <button onClick={() => setEditFor(null)} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Office</label>
                <select value={editOfficeId} onChange={(e) => pickOffice(e.target.value, setEditOfficeId, setEditSupervisorId)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none">
                  <option value="">Select office…</option>
                  {offices?.data.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Supervisor</label>
                <select value={editSupervisorId} onChange={(e) => setEditSupervisorId(e.target.value)}
                  disabled={!editOfficeId || supervisorsFor(editOfficeId).length <= 1}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm focus:border-[#1B4F72] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]">
                  <option value="">
                    {!editOfficeId ? 'Select an office first' : supervisorsFor(editOfficeId).length === 0 ? 'No supervisor in this office' : 'Select supervisor…'}
                  </option>
                  {supervisorsFor(editOfficeId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {editOfficeId && supervisorsFor(editOfficeId).length === 0 && (
                  <p className="mt-1 text-xs text-[#E74C3C]">Assign a supervisor to this office first (Offices page).</p>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs text-[#64748B]">
              The recipient will clock in at the new office&apos;s QR going forward. Hours already rendered are unaffected.
            </p>

            {edit.isError && (
              <p className="mt-2 text-xs text-[#E74C3C]">Could not update the assignment. Please try again.</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditFor(null)}
                className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => edit.mutate()}
                disabled={edit.isPending || !editOfficeId || !editSupervisorId}
                className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-50 transition-colors">
                <MapPin className="h-4 w-4" />
                {edit.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
