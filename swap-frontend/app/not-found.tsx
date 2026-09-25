import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-50 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50">
        <span className="text-4xl font-bold text-brand-700">404</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Page not found</h1>
        <p className="mt-2 text-sm text-ink-500">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  )
}
