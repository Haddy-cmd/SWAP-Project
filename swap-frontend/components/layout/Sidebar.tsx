'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { useNotifications } from '@/lib/hooks/useNotifications'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  BarChart2, Building2, Banknote, Bell, BookOpen,
  ClipboardList, LogOut, Calendar, X, QrCode, ShieldCheck,
} from 'lucide-react'

type NavLink = { label: string; href: string; icon: LucideIcon }

const ROLE_NAV: Record<string, NavLink[]> = {
  applicant: [
    { label: 'Dashboard', href: '/applicant/dashboard', icon: LayoutDashboard },
    { label: 'Application', href: '/applicant/application/new', icon: FileText },
    { label: 'Documents', href: '/applicant/documents', icon: BookOpen },
  ],
  recipient: [
    { label: 'Dashboard', href: '/recipient/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/recipient/attendance', icon: Clock },
    { label: 'Scan QR', href: '/recipient/attendance/scan', icon: CheckSquare },
    { label: 'Hours', href: '/recipient/hours', icon: BarChart2 },
    { label: 'Duty Slip', href: '/recipient/reports/duty-slip', icon: FileText },
    { label: 'Stipend', href: '/recipient/stipend', icon: Banknote },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor/dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/supervisor/students', icon: Users },
    { label: 'Verify', href: '/supervisor/verifications', icon: CheckSquare },
    { label: 'Office QR', href: '/supervisor/qr-code', icon: QrCode },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Applications', href: '/admin/applications', icon: FileText },
    { label: 'Interviews', href: '/admin/interviews', icon: Calendar },
    { label: 'Assignments', href: '/admin/assignments', icon: Users },
    { label: 'Offices', href: '/admin/offices', icon: Building2 },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Stipend', href: '/admin/stipend', icon: Banknote },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart2 },
    { label: 'Reports', href: '/admin/reports', icon: ClipboardList },
    { label: 'Verify Slip', href: '/admin/duty-slip-verify', icon: ShieldCheck },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: BookOpen },
  ],
}

function RailItem({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.label}
      className={cn(
        'group flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-colors',
        active ? 'bg-white/[0.14] text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
      )}
    >
      <Icon className={cn('h-[22px] w-[22px] flex-shrink-0', active && 'text-[#D8B65A]')} />
      <span className="line-clamp-2 text-[10px] font-medium leading-[1.15]">{item.label}</span>
    </Link>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const { logout, isLoggingOut } = useAuth()
  const { data: notif } = useNotifications()
  const unread = notif?.meta?.unread_count ?? 0

  const roleNav = user?.role ? ROLE_NAV[user.role] ?? [] : []

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className="relative flex h-full w-24 flex-col border-r border-black/20"
      style={{ background: 'linear-gradient(180deg, #8E1B1B 0%, #6B1212 55%, #520D0D 100%)' }}
    >
      {/* Close (mobile drawer only) */}
      <button
        onClick={onNavigate}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors md:hidden"
        aria-label="Close menu"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Brand */}
      <Link href={roleNav[0]?.href ?? '/'} onClick={onNavigate} className="flex flex-col items-center gap-1 pt-5 pb-3">
        <Image src="/dsa-logo.png" alt="DSA Logo" width={44} height={44} priority />
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#D8B65A]">SWAP</span>
      </Link>

      {/* Nav rail */}
      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {roleNav.map((item) => (
          <RailItem key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Utility */}
      <div className="flex flex-col items-center gap-2 border-t border-white/10 px-2 py-3">
        <Link
          href="/notifications"
          onClick={onNavigate}
          title="Notifications"
          aria-label="Notifications"
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
            isActive('/notifications') ? 'bg-white/[0.14] text-[#D8B65A]' : 'text-white/60 hover:bg-white/10 hover:text-white',
          )}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <Link
          href="/profile"
          onClick={onNavigate}
          title={user?.name ?? 'Profile'}
          aria-label="Profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B65A] to-[#B8901F] text-sm font-bold text-[#531010] ring-2 ring-white/10 transition hover:brightness-105"
        >
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </Link>

        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>
  )
}
