'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, FileText } from 'lucide-react'
import { applicationsApi } from '@/lib/api/applications.api'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'

export default function DocumentsPage() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => applicationsApi.getMyApplications(),
  })

  const allDocs = applications?.flatMap((app) =>
    (app.documents ?? []).map((doc) => ({ ...doc, application: app })),
  ) ?? []

  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Documents</h1>
        <p className="mt-1 text-sm text-ink-500">All files you have uploaded across your applications.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-xl bg-ink-200" />
          ))}
        </div>
      ) : !allDocs.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300 py-16 text-center">
          <FileText className="h-10 w-10 text-ink-300" />
          <p className="text-sm font-medium text-ink-400">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500">Application</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {allDocs.map((doc) => (
                <tr key={doc.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-ink-400" />
                      <div>
                        <p className="font-medium text-ink-900 capitalize">
                          {doc.document_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-ink-400">{doc.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {doc.application.academic_year} — {doc.application.semester}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setViewDoc(doc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
      {viewDoc && <DocumentViewerModal doc={viewDoc} docs={allDocs} onClose={() => setViewDoc(null)} />}
    </div>
  )
}
