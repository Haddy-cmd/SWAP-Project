'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserCheck, UserX, UserPlus, X } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { assignmentsApi } from '@/lib/api/assignments.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils/formatDate'

function AddUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'supervisor', office_id: '' })
  const [error, setError] = useState('')

  const { data: officesData } = useQuery({
    queryKey: ['admin-offices'],
    queryFn: () => assignmentsApi.getOffices(),
  })
  const offices = officesData?.data ?? []

  const create = useMutation({
    mutationFn: () =>
      adminApi.createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === 'supervisor' && form.office_id ? { office_id: Number(form.office_id) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const firstError = err.response?.data?.errors && Object.values(err.response.data.errors)[0]?.[0]
      setError(firstError || err.response?.data?.message || 'Failed to create user.')
    },
  })

  const canSave = form.name.trim() && form.email.trim() && form.password.length >= 8

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-[#1E293B]">New User</h2>
            <p className="text-sm text-[#8A6A6A]">Create a supervisor, admin, or other account.</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#E74C3C] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Full Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Prof. Juan Dela Cruz"
              className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="supervisor@msumain.edu.ph"
              className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Password</label>
            <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none">
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              <option value="applicant">Applicant</option>
              <option value="recipient">Recipient</option>
            </select>
          </div>
          {form.role === 'supervisor' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8A6A6A]">Office (optional)</label>
              <select value={form.office_id} onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))}
                className="w-full rounded-xl border border-[#DCC5C5] bg-[#FAF7F7] px-3 py-2 text-sm focus:border-[#7D1A1A] focus:outline-none">
                <option value="">{offices.length ? 'Assign later…' : 'No offices yet — assign later'}</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-[#E74C3C]">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={() => { setError(''); create.mutate() }} disabled={!canSave || create.isPending}
            className="flex-1 rounded-xl bg-[#7D1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-50 transition-colors">
            {create.isPending ? 'Creating…' : 'Create User'}
          </button>
          <button onClick={onClose}
            className="rounded-xl border border-[#EAD9D9] px-5 py-2.5 text-sm font-semibold text-[#8A6A6A] hover:bg-[#FAF7F7] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn: () => adminApi.getUsers({ page: String(page), ...(search && { search }), ...(role && { role }) }),
  })

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      adminApi.updateUser(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const users = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Users</h1>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-[#7D1A1A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors">
          <UserPlus className="h-4 w-4" />
          New User
        </button>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B09A9A]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search users…"
            className="w-full rounded-xl border border-[#DCC5C5] bg-white py-2.5 pl-9 pr-4 text-sm focus:border-[#7D1A1A] focus:outline-none" />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}
          className="rounded-xl border border-[#DCC5C5] bg-white px-4 py-2.5 text-sm focus:border-[#7D1A1A] focus:outline-none">
          <option value="">All Roles</option>
          <option value="applicant">Applicant</option>
          <option value="recipient">Recipient</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[#EAD9D9] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#EAD9D9]" />)}</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#EAD9D9] bg-[#FAF7F7]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#8A6A6A]">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[#F5EDEC] last:border-0 hover:bg-[#FAF7F7]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#1E293B]">{user.name}</p>
                    <p className="text-xs text-[#B09A9A]">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#FEF0F0] px-2.5 py-0.5 text-xs font-medium text-[#7D1A1A] capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8A6A6A]">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.is_active ? 'bg-green-50 text-[#27AE60]' : 'bg-red-50 text-[#E74C3C]'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle.mutate({ id: user.id, is_active: !user.is_active })}
                      disabled={toggle.isPending}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        user.is_active
                          ? 'border-red-200 text-[#E74C3C] hover:bg-red-50'
                          : 'border-green-200 text-[#27AE60] hover:bg-green-50'
                      }`}
                    >
                      {user.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-[#EAD9D9] px-4 py-3">
            <p className="text-xs text-[#8A6A6A]">Page {meta.current_page} of {meta.last_page} · {meta.total} total</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] disabled:opacity-40 transition-colors">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === meta.last_page}
                className="rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
