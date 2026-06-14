import type { UserRole } from '@/types/auth.types'

export function getRoleDashboard(role: UserRole): string {
  const routes: Record<UserRole, string> = {
    admin: '/admin/dashboard',
    recipient: '/recipient/dashboard',
    supervisor: '/supervisor/dashboard',
    applicant: '/applicant/dashboard',
  }
  return routes[role]
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  const routeRoles: Record<string, UserRole[]> = {
    '/admin': ['admin'],
    '/recipient': ['recipient'],
    '/supervisor': ['supervisor'],
    '/applicant': ['applicant'],
  }

  const requiredRoles = Object.entries(routeRoles).find(([prefix]) =>
    path.startsWith(prefix)
  )?.[1]

  if (!requiredRoles) return true
  return requiredRoles.includes(role)
}
