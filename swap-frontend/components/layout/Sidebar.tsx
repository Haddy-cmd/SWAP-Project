'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/lib/store/authStore'
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  BarChart2, Building2, Banknote, Bell, User, BookOpen,
  ClipboardList, LogOut, GraduationCap, Calendar,
} from 'lucide-react'

const ROLE_NAV = {
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

const COMMON_NAV = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const roleNav = user?.role ? ROLE_NAV[user.role] ?? [] : []

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="flex h-full w-64 flex-col" style={{ background: 'linear-gradient(180deg, #8B1A1A 0%, #6B1212 100%)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide">SWAP Portal</p>
          <p className="text-xs text-white/50">MSU Marawi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {roleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive(item.href)
                  ? 'bg-white/20 text-white shadow-sm border-l-[3px] border-[#F5C842] pl-[9px]'
                  : 'text-white/65 hover:bg-white/10 hover:text-white border-l-[3px] border-transparent pl-[9px]'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 space-y-0.5">
          {COMMON_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive(item.href)
                  ? 'bg-white/20 text-white shadow-sm border-l-[3px] border-[#F5C842] pl-[9px]'
                  : 'text-white/65 hover:bg-white/10 hover:text-white border-l-[3px] border-transparent pl-[9px]'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white ring-2 ring-white/10">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-white/50 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
