import type { ReactNode } from 'react'

/** Re-mounted on every navigation, so each sign-in page fades in. */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
