'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Hours and Attendance are one page now (/recipient/attendance). Old links — emails, bell
 * notifications, bookmarks — land here and move on, keeping `#report` and any query.
 */
export default function HoursRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/recipient/attendance${window.location.search}${window.location.hash}`)
  }, [router])
  return <div className="h-64 animate-pulse rounded-[20px] bg-ink-100" />
}
