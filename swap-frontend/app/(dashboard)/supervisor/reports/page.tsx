import { redirect } from 'next/navigation'

/**
 * The supervisor's Analytics & Reports moved into Students (hours sheet download on "This term",
 * Term Results on "Term results"); old links and bookmarks land on the same view there.
 */
export default async function SupervisorReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  if (params.tab !== 'term-results') redirect('/supervisor/students')

  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v)
  }
  redirect(`/supervisor/students?${qs.toString()}`)
}
