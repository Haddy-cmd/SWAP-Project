'use client'

import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/utils/cn'

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { desktopSidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF7F7]">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, collapsible column on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          'md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-200',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          desktopSidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden',
        )}
      >
        <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
