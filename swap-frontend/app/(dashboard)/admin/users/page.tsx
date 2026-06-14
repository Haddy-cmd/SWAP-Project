'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserCheck, UserX } from 'lucide-react'
import { adminApi } from '@/lib/api/admin.api'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils/formatDate'

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')

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
      <h1 className="text-2xl font-bold text-[#1E293B]">Users</h1>

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
          <table className="w-full text-sm">
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
          </table>
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
