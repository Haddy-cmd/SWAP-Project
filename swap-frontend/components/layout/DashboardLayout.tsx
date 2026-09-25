'use client'

import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/utils/cn'

// Soft seal-green glow top-left, gold glow bottom-right, a lift of white in the middle.
const AMBIENT_BG =
  'radial-gradient(circle at 12% 8%, rgba(31,91,58,.14), transparent 34%), ' +
  'radial-gradient(circle at 90% 88%, rgba(212,174,34,.12), transparent 32%), ' +
  'radial-gradient(circle at 60% 40%, rgba(255,255,255,.7), transparent 45%)'

/** Decorative, non-interactive backdrop: blurred light sweeps and a faint seal watermark. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden print:hidden">
      <div className="absolute right-10 top-[70px] h-[420px] w-[420px] rounded-full bg-brand-500/5 blur-[80px]" />
      <div
        className="absolute -top-[18%] left-[30%] h-[520px] w-[1100px] -rotate-[14deg] rounded-full blur-[30px]"
        style={{ background: 'linear-gradient(100deg, rgba(42,113,72,.10), rgba(42,113,72,0) 70%)' }}
      />
      <div
        className="absolute -bottom-[24%] left-[8%] h-[560px] w-[1300px] rotate-[8deg] rounded-full blur-[36px]"
        style={{ background: 'linear-gradient(80deg, rgba(42,113,72,.09), rgba(212,174,34,.07) 60%, rgba(212,174,34,0))' }}
      />
      {/* Oversized engraved seal tucked into the bottom-right corner. The watermark file
          is cropped tight to the seal, so shifting it 27% right and down keeps 73% of its
          width and height on screen, which is 60% of the seal's oval area. */}
      <div className="absolute bottom-0 right-0 aspect-[5405/6250] h-[min(104vh,1020px)] translate-x-[27%] translate-y-[27%]">
        {/* Detail layer: monochrome relief of the seal. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dsa-seal-watermark.webp"
          alt=""
          className="absolute inset-0 h-full w-full opacity-[0.10] [filter:grayscale(1)_contrast(1.2)]"
        />
        {/* Tint layer: washes the seal's shape in seal green. */}
        <div
          className="absolute inset-0 bg-brand-700 opacity-[0.06]"
          style={{
            maskImage: 'url(/dsa-seal-watermark.webp)',
            WebkitMaskImage: 'url(/dsa-seal-watermark.webp)',
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      </div>
    </div>
  )
}

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
    // print:* — printable documents (duty slips) are positioned against the page, so
    // in print this shell must neither clip them (overflow/height) nor act as their
    // containing block (position); the chrome itself is dropped.
    <div
      className="relative h-screen overflow-hidden bg-ink-50 print:static print:h-auto print:overflow-visible"
      style={{ backgroundImage: AMBIENT_BG }}
    >
      <Backdrop />

      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden print:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Hover-reveal hot zone on the left edge (desktop, auto-hide mode only) */}
      {!pinned && (
        <div className="fixed left-0 top-0 z-30 hidden h-full w-3 md:block print:hidden" onMouseEnter={revealSidebar} aria-hidden="true" />
      )}

      {/* Sidebar — fixed overlay; slides in/out */}
      <div
        onMouseEnter={revealSidebar}
        onMouseLeave={scheduleHideSidebar}
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out print:hidden',
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
          'relative z-[1] flex h-full flex-col overflow-hidden transition-[margin] duration-200 ease-in-out',
          'print:static print:h-auto print:overflow-visible print:ml-0',
          revealed ? 'md:ml-24' : 'md:ml-0',
        )}
      >
        <Topbar />
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="max-w-7xl mx-auto p-4 md:p-6 print:max-w-none print:p-0">{children}</div>
        </main>
      </div>
    </div>
  )
}
