'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useNotifications } from '@/lib/hooks/useNotifications'

export function Topbar() {
  const { user } = useAuthStore()
  const { data } = useNotifications()
  const unread = data?.meta?.unread_count ?? 0

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#EAD9D9] bg-white px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-5 w-[3px] rounded-full bg-[#7D1A1A]" />
        <div>
          <p className="text-sm font-semibold text-[#1E293B] capitalize">
            {user?.role} Portal
          </p>
          <p className="text-xs text-[#8A6A6A]">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'SWAP Portal'} — MSU Marawi
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#EAD9D9] text-[#8A6A6A] hover:bg-[#FAF7F7] hover:text-[#7D1A1A] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E74C3C] text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-sm font-medium text-[#1E293B] hover:bg-[#FAF7F7] transition-colors"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7D1A1A] text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <span className="hidden sm:inline">{user?.name}</span>
        </Link>
      </div>
    </header>
  )
}
