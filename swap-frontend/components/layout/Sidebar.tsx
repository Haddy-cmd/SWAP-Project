'use client'

import Link, { useLinkStatus } from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { avatarSrc } from '@/lib/utils/avatar'
import { useAuthStore } from '@/lib/store/authStore'
import { useAuth } from '@/lib/hooks/useAuth'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { Bell, LogOut, X } from 'lucide-react'
import { ROLE_NAV, type NavLink } from '@/lib/constants/navigation'

function RailItem({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate?: () => void }) {
  return (
    <Link href={item.href} onClick={onNavigate} title={item.label} className="block">
      <RailContent item={item} active={active} />
    </Link>
  )
}

/** Inside the Link, so a clicked item lights up (with a soft pulse) before its page arrives. */
function RailContent({ item, active }: { item: NavLink; active: boolean }) {
  const { pending } = useLinkStatus()
  const on = active || pending
  const Icon = item.icon
  return (
    <span className={cn(
      'group relative flex flex-col items-center gap-[5px] rounded-xl px-1 pb-2.5 pt-[11px] text-center transition-colors',
      on ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.08] hover:text-white',
    )}>
      {/* Gold marker for the current page, echoing the seal's lettering. */}
      {on && <span aria-hidden className="absolute inset-y-2.5 -left-2 w-[3px] rounded-r-full bg-gold-400" />}
      <Icon className={cn('h-[23px] w-[23px] flex-shrink-0', on && 'text-gold-400', pending && 'animate-live')} />
      <span className={cn('line-clamp-2 text-[10.5px] leading-[1.15]', on ? 'font-bold' : 'font-medium')}>{item.label}</span>
    </span>
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
  // Only the most specific match lights up, so /recipient/reports/duty-slip marks
  // Duty Slip but not My Reports (and Scan QR not Attendance).
  const activeHref = roleNav.filter((i) => isActive(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href

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
          <RailItem key={item.href} item={item} active={item.href === activeHref} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Utility */}
      <div className="flex flex-col items-center gap-2 border-t border-white/10 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
