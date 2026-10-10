'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, X } from 'lucide-react'
import { DocumentViewerModal, type ViewableDocument } from '@/components/shared/DocumentViewerModal'
import { supervisorApi, type StudentDocument } from '@/lib/api/supervisor.api'

type Selected = { userId: number; name: string }

// Group a student's documents by the term they were submitted for, so a renewal's
// updated COR/grades don't blend into the original application's documents. Backend
// already returns them newest-term-first, so group order is preserved.
function groupDocsByTerm(docs: StudentDocument[]) {
  const groups: { key: string; label: string; type: 'new' | 'renewal'; docs: StudentDocument[] }[] = []
  for (const doc of docs) {
    const key = String(doc.application_id)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      const term = [doc.academic_year, doc.semester].filter(Boolean).join(' · ')
      group = { key, label: term || 'Application requirements', type: doc.type, docs: [] }
      groups.push(group)
    }
    group.docs.push(doc)
  }
  return groups
}

export function StudentDocumentsModal({ student, onClose }: { student: Selected; onClose: () => void }) {
  const [viewDoc, setViewDoc] = useState<ViewableDocument | null>(null)
  const { data: docs, isLoading } = useQuery({
    queryKey: ['student-documents', student.userId],
    queryFn: () => supervisorApi.getStudentDocuments(student.userId),
  })

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">Documents</h2>
            <p className="text-sm text-ink-500">{student.name}&apos;s application requirements</p>
          </div>
          <button onClick={onClose} className="text-ink-350 hover:text-danger-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-ink-200/60" />)}</div>
        ) : !docs?.length ? (
          <p className="py-8 text-center text-sm text-ink-350">No documents on file for this student.</p>
        ) : (
          <div className="space-y-5">
            {groupDocsByTerm(docs).map((group) => (
              <div key={group.key}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{group.label}</p>
                  {group.type === 'renewal' && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">Renewal</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {group.docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3">
                      <p className="text-sm capitalize text-ink-900">{doc.document_type.replace(/_/g, ' ')}</p>
                      <button onClick={() => setViewDoc(doc)} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewDoc && <DocumentViewerModal doc={viewDoc} docs={docs ?? []} onClose={() => setViewDoc(null)} />}
    </div>
  )
}
