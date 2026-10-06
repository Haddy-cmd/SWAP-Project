import { redirect } from 'next/navigation'

/** Reports moved into Analytics & Reports; old links and bookmarks land on its first report tab. */
export default function AdminReportsPage() {
  redirect('/admin/analytics?tab=applications')
}
