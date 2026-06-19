'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useUIStore } from '@/lib/store/uiStore'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function Topbar() {
  const { user } = useAuthStore()
  const {
    desktopSidebarOpen, toggleDesktopSidebar, toggleMobileSidebar,
    revealSidebar, scheduleHideSidebar,
  } = useUIStore()

  // One button: collapse the column on desktop, open the drawer on mobile.
  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      toggleDesktopSidebar()
    } else {
      toggleMobileSidebar()
    }
  }

  // Hovering the button also reveals the nav while it's in auto-hide mode.
  const onButtonEnter = () => { if (!desktopSidebarOpen) revealSidebar() }
  const onButtonLeave = () => { if (!desktopSidebarOpen) scheduleHideSidebar() }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#EAD9D9] bg-white px-4 shadow-sm md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={toggleSidebar}
          onMouseEnter={onButtonEnter}
          onMouseLeave={onButtonLeave}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[#7D1A1A] hover:bg-[#FEF0F0] active:scale-95 transition-all"
          aria-label="Toggle menu"
          title="Toggle menu"
        >
          <Menu className="h-[22px] w-[22px]" />
        </button>
        <div className="h-5 w-[3px] flex-shrink-0 rounded-full bg-[#7D1A1A]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1E293B] capitalize">
            {user?.role} Portal
          </p>
          <p className="hidden truncate text-xs text-[#8A6A6A] sm:block">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'SWAP Portal'} — MSU Marawi
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell />

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
