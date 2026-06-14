'use client'

import { useQuery } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'

export default function DocumentsPage() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  const allDocs = applications?.flatMap((app) =>
    (app.documents ?? []).map((doc) => ({ ...doc, application: app })),
  ) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">My Documents</h1>
        <p className="mt-1 text-sm text-[#8A6A6A]">All files you have uploaded across your applications.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-xl bg-[#EAD9D9]" />
          ))}
        </div>
      ) : !allDocs.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#DCC5C5] py-16 text-center">
          <FileText className="h-10 w-10 text-[#DCC5C5]" />
          <p className="text-sm font-medium text-[#B09A9A]">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#EAD9D9] bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#EAD9D9] bg-[#FAF7F7]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A6A6A]">Application</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#8A6A6A]">Action</th>
              </tr>
            </thead>
            <tbody>
              {allDocs.map((doc) => (
                <tr key={doc.id} className="border-b border-[#F5EDEC] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#B09A9A]" />
                      <div>
                        <p className="font-medium text-[#1E293B] capitalize">
                          {doc.document_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-[#B09A9A]">{doc.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#8A6A6A]">
                    {doc.application.academic_year} — {doc.application.semester}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#EAD9D9] px-3 py-1.5 text-xs font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
