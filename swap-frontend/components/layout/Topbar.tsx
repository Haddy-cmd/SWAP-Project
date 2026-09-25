'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { useUIStore } from '@/lib/store/uiStore'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { avatarSrc } from '@/lib/utils/avatar'

export function Topbar() {
  const { user, token } = useAuthStore()
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-5 border-b border-ink-900/10 bg-white/70 px-4 backdrop-blur-md md:pl-8 md:pr-6">
      <div className="flex min-w-0 flex-1 items-center gap-[18px]">
        <button
          onClick={toggleSidebar}
          onMouseEnter={onButtonEnter}
          onMouseLeave={onButtonLeave}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-brand-50 hover:text-brand-700 active:scale-95 transition-all"
          aria-label="Toggle menu"
          title="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0 border-l-2 border-brand-600 pl-3.5 leading-[1.3]">
          <p className="truncate text-[14.5px] font-bold text-ink-900 capitalize">
            {user?.role} Portal
          </p>
          <p className="hidden truncate text-xs text-ink-500 sm:block">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'SWAP Portal'} — MSU Marawi
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5">
        <NotificationBell />

        <Link
          href="/profile"
          className="flex h-[38px] items-center gap-[9px] rounded-[10px] border border-ink-900/15 bg-white pl-[5px] pr-[5px] text-[13.5px] font-semibold text-ink-900 transition-colors hover:bg-ink-50 sm:pr-3.5"
        >
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[11px] font-bold text-brand-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(user?.avatar_url, token) ?? '/default-avatar.svg'} alt={user?.name ?? ''} className="h-full w-full object-cover" />
          </div>
          <span className="hidden whitespace-nowrap sm:inline">{user?.name}</span>
        </Link>
      </div>
    </header>
  )
}
