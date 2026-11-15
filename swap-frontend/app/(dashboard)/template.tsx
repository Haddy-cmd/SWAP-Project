import type { ReactNode } from 'react'

/** Re-mounted on every navigation (unlike the layout), so each page fades in while the sidebar stays put. */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
