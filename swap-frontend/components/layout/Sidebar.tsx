'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { avatarSrc } from '@/lib/utils/avatar'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { useNotifications } from '@/lib/hooks/useNotifications'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  BarChart2, Building2, Banknote, Bell, BookOpen,
  ClipboardList, LogOut, Calendar, X, QrCode, ShieldCheck, RefreshCw,
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
    { label: 'Renewal', href: '/recipient/renewal', icon: RefreshCw },
    { label: 'Stipend', href: '/recipient/stipend', icon: Banknote },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor/dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/supervisor/students', icon: Users },
    { label: 'Verify', href: '/supervisor/verifications', icon: CheckSquare },
    { label: 'Promissory', href: '/supervisor/promissory', icon: FileText },
    { label: 'Summary', href: '/supervisor/reports', icon: BarChart2 },
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
        'group relative flex flex-col items-center gap-[5px] rounded-xl px-1 pb-2.5 pt-[11px] text-center transition-colors',
        active ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      {/* Gold marker for the current page, echoing the seal's lettering. */}
      {active && <span aria-hidden className="absolute inset-y-2.5 -left-2 w-[3px] rounded-r-full bg-gold-400" />}
      <Icon className={cn('h-[23px] w-[23px] flex-shrink-0', active && 'text-gold-400')} />
      <span className={cn('line-clamp-2 text-[10.5px] leading-[1.15]', active ? 'font-bold' : 'font-medium')}>{item.label}</span>
    </Link>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, token } = useAuthStore()
  const { logout, isLoggingOut } = useAuth()
  const { data: notif } = useNotifications()
  const unread = notif?.meta?.unread_count ?? 0

  const roleNav = user?.role ? ROLE_NAV[user.role] ?? [] : []

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className="relative flex h-full w-24 flex-col border-r border-black/20"
      style={{ background: 'linear-gradient(180deg, #16452B 0%, #10331F 55%, #0B2716 100%)' }}
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
      <Link href={roleNav[0]?.href ?? '/'} onClick={onNavigate} className="flex flex-col items-center gap-2.5 pb-[18px] pt-[22px]">
        <Image src="/dsa-logo.png" alt="DSA Logo" width={36} height={36} priority />
        <span className="text-[10.5px] font-extrabold tracking-[0.14em] text-gold-400">SWAP</span>
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
            isActive('/notifications') ? 'bg-white/[0.14] text-gold-400' : 'text-white/60 hover:bg-white/10 hover:text-white',
          )}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <Link
          href="/profile"
          onClick={onNavigate}
          title={user?.name ?? 'Profile'}
          aria-label="Profile"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-sm font-bold text-brand-950 ring-2 ring-white/10 transition hover:brightness-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc(user?.avatar_url, token) ?? '/default-avatar.svg'} alt={user?.name ?? ''} className="h-full w-full object-cover" />
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
