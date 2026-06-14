'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil } from 'lucide-react'
import { assignmentsApi } from '@/lib/api/assignments.api'
import type { Office } from '@/types/assignment.types'

function OfficeForm({ initial, onSave, onCancel, loading }: {
  initial?: Partial<Office>
  onSave: (data: Partial<Office>) => void
  onCancel: () => void
  loading?: boolean
}) {
  const [form, setForm] = useState<Partial<Office>>({
    name: '', code: '', description: '', head_name: '', location: '', max_recipients: 10, is_active: true,
    ...initial,
  })

  return (
    <div className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm space-y-4">
      <h2 className="font-semibold text-[#1E293B]">{initial?.id ? 'Edit Office' : 'New Office'}</h2>
      <div className="grid grid-cols-2 gap-4">
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
      <div className="flex gap-3">
        <button onClick={() => onSave(form)} disabled={loading}
          className="rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="rounded-xl border border-[#EAD9D9] px-5 py-2.5 text-sm font-semibold text-[#8A6A6A] hover:bg-[#FAF7F7] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function AdminOfficesPage() {
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Office | null>(null)

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
            <div key={office.id} className="rounded-2xl border border-[#EAD9D9] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1E293B]">{office.name}</p>
                  <p className="text-xs text-[#8A6A6A]">{office.code}</p>
                </div>
                <button onClick={() => setEditing(office)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAD9D9] text-[#8A6A6A] hover:bg-[#FAF7F7] transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {office.head_name && <p className="mt-2 text-xs text-[#8A6A6A]">Head: {office.head_name}</p>}
              {office.location && <p className="text-xs text-[#8A6A6A]">Location: {office.location}</p>}
              <p className="mt-2 text-xs font-medium text-[#7D1A1A]">Max: {office.max_recipients} recipients</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                office.is_active ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
              }`}>{office.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
