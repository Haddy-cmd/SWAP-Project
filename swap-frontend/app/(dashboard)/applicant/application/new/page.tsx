import { ApplicationForm } from '@/components/application/ApplicationForm'

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">New Application</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Complete all fields and upload the required documents.
        </p>
      </div>
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <ApplicationForm />
      </div>
    </div>
  )
}
