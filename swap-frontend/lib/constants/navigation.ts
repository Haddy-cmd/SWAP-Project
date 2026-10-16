import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  BarChart2, Building2, Banknote, BookOpen,
  ClipboardList, CalendarRange, QrCode, RefreshCw, Images, Megaphone, Inbox,
} from 'lucide-react'

export type NavLink = { label: string; href: string; icon: LucideIcon }

/**
 * Each role's menu (the sidebar), the dashboard first. DashboardLayout also uses it: every
 * menu page except the dashboard gets a "← Back" link above its content.
 */
export const ROLE_NAV: Record<string, NavLink[]> = {
  applicant: [
    { label: 'Dashboard', href: '/applicant/dashboard', icon: LayoutDashboard },
    { label: 'Application', href: '/applicant/application/new', icon: FileText },
    { label: 'Documents', href: '/applicant/documents', icon: BookOpen },
  ],
  recipient: [
    { label: 'Dashboard', href: '/recipient/dashboard', icon: LayoutDashboard },
    // Clock in/out, hours, logs and the end-of-term report in one page (Scan is inside it).
    { label: 'Hours & attendance', href: '/recipient/attendance', icon: Clock },
    { label: 'My Reports', href: '/recipient/reports', icon: ClipboardList },
    { label: 'Duty Slip', href: '/recipient/reports/duty-slip', icon: FileText },
    { label: 'Renewal', href: '/recipient/renewal', icon: RefreshCw },
    { label: 'Stipend', href: '/recipient/stipend', icon: Banknote },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor/dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/supervisor/students', icon: Users },
    { label: 'Verify', href: '/supervisor/verifications', icon: CheckSquare },
    { label: 'Promissory', href: '/supervisor/promissory', icon: FileText },
    { label: 'Office QR', href: '/supervisor/qr-code', icon: QrCode },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    // Interviews are in Applications → Interview set → Calendar.
    { label: 'Applications', href: '/admin/applications', icon: FileText },
    { label: 'Assignments', href: '/admin/assignments', icon: Users },
    { label: 'Offices', href: '/admin/offices', icon: Building2 },
    { label: 'Semesters', href: '/admin/semesters', icon: CalendarRange },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Stipend', href: '/admin/stipend', icon: Banknote },
    { label: 'Analytics & Reports', href: '/admin/analytics', icon: BarChart2 },
    { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    { label: 'Concerns', href: '/admin/concerns', icon: Inbox },
    { label: 'Landing Page', href: '/admin/landing', icon: Images },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: BookOpen },
    // System Testing has no menu item: open /admin/testing directly (only while SWAP_TEST_TOOLS is on).
  ],
}
