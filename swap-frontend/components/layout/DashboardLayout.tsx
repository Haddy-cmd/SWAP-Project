'use client'

import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/utils/cn'

export function DashboardLayout({ children }: { children: ReactNode }) {
  const {
    desktopSidebarOpen, mobileSidebarOpen, setMobileSidebarOpen,
    sidebarRevealed, revealSidebar, scheduleHideSidebar,
  } = useUIStore()

  // Pinned = always visible (pushes content). Otherwise it auto-hides and reveals on hover.
  const pinned = desktopSidebarOpen
  const revealed = pinned || sidebarRevealed

  const handleNavigate = () => {
    setMobileSidebarOpen(false)
  }

  return (
    <div className="h-screen overflow-hidden bg-[#FAF7F7]">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Hover-reveal hot zone on the left edge (desktop, auto-hide mode only) */}
      {!pinned && (
        <div className="fixed left-0 top-0 z-30 hidden h-full w-3 md:block" onMouseEnter={revealSidebar} aria-hidden="true" />
      )}

      {/* Sidebar — fixed overlay; slides in/out */}
      <div
        onMouseEnter={revealSidebar}
        onMouseLeave={scheduleHideSidebar}
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          revealed ? 'md:translate-x-0' : 'md:-translate-x-full',
          !pinned && 'md:shadow-2xl', // float above content when auto-revealed
        )}
      >
        <Sidebar onNavigate={handleNavigate} />
      </div>

      {/* Main content — shifts over whenever the sidebar is showing (pinned or hover-revealed) */}
      <div
        className={cn(
          'flex h-full flex-col overflow-hidden transition-[margin] duration-200 ease-in-out',
          revealed ? 'md:ml-64' : 'md:ml-0',
        )}
      >
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
