import { redirect } from 'next/navigation'

/** Interviews moved into Applications → Interview set → Calendar; old links and bookmarks land there. */
export default function AdminInterviewsPage() {
  redirect('/admin/applications?status=interview_scheduled&view=calendar')
}
