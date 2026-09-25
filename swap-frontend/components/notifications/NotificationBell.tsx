'use client'

import { useRef, useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { NotificationDropdown } from './NotificationDropdown'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()
  const notifications = data?.data ?? []
  const unread = data?.meta?.unread_count ?? 0

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-ink-900/15 bg-white text-ink-700 hover:bg-ink-50 hover:text-brand-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-[21px] w-[21px]" />
        {unread > 0 && (
          <span className="absolute -right-[7px] -top-[7px] min-w-[18px] rounded-[10px] border-2 border-white bg-danger-600 px-[5px] py-[2px] text-center text-[9px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
