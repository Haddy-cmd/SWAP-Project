'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  BarChart2, Building2, Banknote, Bell, User, BookOpen,
  ClipboardList, LogOut, GraduationCap, Calendar, X,
} from 'lucide-react'

type NavLink = { label: string; href: string; icon: LucideIcon }

const ROLE_NAV: Record<string, NavLink[]> = {
  applicant: [
    { label: 'Dashboard', href: '/applicant/dashboard', icon: LayoutDashboard },
    { label: 'My Application', href: '/applicant/application/new', icon: FileText },
    { label: 'Documents', href: '/applicant/documents', icon: BookOpen },
  ],
  recipient: [
    { label: 'Dashboard', href: '/recipient/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/recipient/attendance', icon: Clock },
    { label: 'Scan QR', href: '/recipient/attendance/scan', icon: CheckSquare },
    { label: 'Hours', href: '/recipient/hours', icon: BarChart2 },
    { label: 'Reports', href: '/recipient/reports/weekly', icon: ClipboardList },
    { label: 'Stipend', href: '/recipient/stipend', icon: Banknote },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor/dashboard', icon: LayoutDashboard },
    { label: 'My Students', href: '/supervisor/students', icon: Users },
    { label: 'Verifications', href: '/supervisor/verifications', icon: CheckSquare },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Applications', href: '/admin/applications', icon: FileText },
    { label: 'Interviews', href: '/admin/interviews', icon: Calendar },
    { label: 'Assignments', href: '/admin/assignments', icon: GraduationCap },
    { label: 'Offices', href: '/admin/offices', icon: Building2 },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Stipend', href: '/admin/stipend', icon: Banknote },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart2 },
    { label: 'Reports', href: '/admin/reports', icon: ClipboardList },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: BookOpen },
  ],
}

const COMMON_NAV: NavLink[] = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
]

function NavRow({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-150',
        active
          ? 'bg-white/[0.13] font-semibold text-white shadow-sm'
          : 'font-medium text-white/60 hover:bg-white/[0.07] hover:text-white',
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#F5C842]" />}
      <span
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
          active ? 'bg-white/15 text-[#F5C842]' : 'text-white/70 group-hover:text-white',
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{children}</p>
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  // Full logout: revokes the server token, clears cached data, and redirects to /login immediately.
  const { logout: handleLogout, isLoggingOut } = useAuth()

  const roleNav = user?.role ? ROLE_NAV[user.role] ?? [] : []

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className="flex h-full w-64 flex-col border-r border-black/20 text-white"
      style={{ background: 'linear-gradient(170deg, #8E1B1B 0%, #6B1212 55%, #520D0D 100%)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F5C842] to-[#D9A520] shadow-md">
          <GraduationCap className="h-5 w-5 text-[#6B1212]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[15px] font-bold tracking-wide text-white">SWAP Portal</p>
          <p className="truncate text-xs text-white/45">MSU Marawi</p>
        </div>
        <button
          onClick={onNavigate}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
        <SectionLabel>Menu</SectionLabel>
        <div className="space-y-1">
          {roleNav.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="my-3 h-px bg-white/10" />

        <SectionLabel>General</SectionLabel>
        <div className="space-y-1">
          {COMMON_NAV.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {/* Profile card */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F5C842] to-[#D9A520] text-sm font-bold text-[#6B1212]">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs capitalize text-white/50">{user?.role}</p>
          </div>
          <button
            onClick={() => handleLogout()}
            disabled={isLoggingOut}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
