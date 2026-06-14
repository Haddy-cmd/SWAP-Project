import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F8FAFC] px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EBF5FB]">
        <span className="text-4xl font-bold text-[#1B4F72]">404</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Page not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-[#1B4F72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2980B9] transition-colors"
      >
        Back to Home
      </Link>
    </div>
  )
}
