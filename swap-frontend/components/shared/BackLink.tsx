'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * The "← Back to …" link at the top-left of a sub-page or an off-menu page (top-level pages
 * in the sidebar don't get one). `history`: go back to the page you came from when there is
 * one in this tab, else to `href` (e.g. a page opened in a new tab). `guard`: asked first
 * (unsaved changes); false keeps the page. Never printed.
 */
export function BackLink({ href, label = 'Back', history = false, guard, className = '' }: {
  href: string
  label?: string
  history?: boolean
  guard?: () => boolean | Promise<boolean>
  className?: string
}) {
  const router = useRouter()

  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / new-window clicks with the plain href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    if (!history && !guard) return
    e.preventDefault()
    if (guard && !(await guard())) return
    if (history && window.history.length > 1) router.back()
    else router.push(href)
  }

  return (
    <Link href={href} onClick={onClick}
      className={`no-print inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-600 transition-colors hover:text-accent-strong ${className}`}>
      <ArrowLeft className="h-[18px] w-[18px]" /> {label}
    </Link>
  )
}
