'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Send, CalendarRange } from 'lucide-react'
import { DocumentUpload } from './DocumentUpload'
import { applicationsApi } from '@/lib/api/applications.api'
import { settingsApi } from '@/lib/api/settings.api'
import type { ApiError } from '@/types/api.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'

// Same text as ApplicationService::MSG_NO_TERM.
const NO_TERM_MESSAGE = 'Applications open once the DSA sets up the current semester. Please check back later.'

export function ApplicationForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [cor, setCor] = useState<File | null>(null)
  const [grades, setGrades] = useState<File | null>(null)
  const [letterOfIntent, setLetterOfIntent] = useState<File | null>(null)
  const [idPhoto, setIdPhoto] = useState<File | null>(null)
  const [docErrors, setDocErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // The term isn't chosen: it's the current semester (the server sets it the same way).
  const { data: status, isLoading: termLoading } = useQuery({
    queryKey: ['application-status'],
    queryFn: () => settingsApi.getApplicationStatus(),
  })
  const term = status?.term ?? null

  const { notify, confirm } = useFeedback()
  const mutation = useMutation({
    mutationFn: async () => {
      const application = await applicationsApi.submitApplication()
      const files: Array<{ key: string; file: File }> = []
      if (cor) files.push({ key: 'cor', file: cor })
      if (grades) files.push({ key: 'grades', file: grades })
      if (letterOfIntent) files.push({ key: 'letter_of_intent', file: letterOfIntent })
      if (idPhoto) files.push({ key: 'id_photo', file: idPhoto })
      try {
        for (const { key, file } of files) {
          const fd = new FormData()
          fd.append('document_type', key)
          fd.append('file', file)
          await applicationsApi.uploadDocument(application.id, fd)
        }
      } catch (uploadErr) {
        // A document failed to upload — roll back the just-created application so
        // it doesn't sit "in review" with no documents (and block re-submission).
        try {
          await applicationsApi.cancelApplication(application.id)
        } catch {
          // Best effort; surface the original upload error regardless.
        }
        throw {
          message: 'Your documents could not be uploaded, so the application was not submitted. Please try again.',
          cause: uploadErr,
        }
      }
      return application
    },
    onSuccess: (res) => {
      notify({ title: 'Application submitted', detail: "The DSA Office will review it. You'll be notified by email at each step." })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['application-status'] })
      router.push(`/applicant/application/${res.id}`)
    },
    onError: (err: ApiError) => {
      if (err.errors) {
        const docErrs: Record<string, string> = {}
        Object.entries(err.errors).forEach(([k, v]) => {
          if (k.startsWith('documents.')) {
            docErrs[k.replace('documents.', '')] = v[0]
          }
        })
        setDocErrors(docErrs)
      }
      setServerError(err.message ?? 'Submission failed. Please try again.')
    },
  })

  function validateDocs(): boolean {
    const errs: Record<string, string> = {}
    if (!cor) errs['cor'] = 'Certificate of Registration is required'
    if (!grades) errs['grades'] = 'Grade Card is required'
    if (!letterOfIntent) errs['letter_of_intent'] = 'Letter of Intent is required'
    if (!idPhoto) errs['id_photo'] = '2×2 Photo is required'
    setDocErrors(errs)
    return Object.keys(errs).length === 0
  }


  async function onSubmit() {
    if (!validateDocs()) return
    setServerError(null)
    // One application per semester: make sure before it goes in.
    const ok = await confirm({
      title: term ? `Submit your application for ${term.semester} ${term.academic_year}?` : 'Submit your application?',
      body: "Your documents go to the DSA Office for review. You can't replace them after submitting.",
      confirmLabel: 'Submit application',
    })
    if (ok) mutation.mutate()
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                s === step
                  ? 'bg-brand-700 text-white'
                  : s < step
                  ? 'bg-success-600 text-white'
                  : 'bg-ink-200 text-ink-500'
              }`}
            >
              {s}
            </div>
            {s < 2 && (
              <div
                className={`h-0.5 w-16 rounded ${s < step ? 'bg-success-600' : 'bg-ink-200'}`}
              />
            )}
          </div>
        ))}
        <div className="ml-2 text-sm font-medium text-ink-500">
          {step === 1 ? 'Application Info' : 'Supporting Documents'}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-ink-200 bg-white p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
              <CalendarRange className="h-4 w-4 text-brand-700" /> Applying for
            </p>
            {termLoading ? (
              <div className="mt-2 h-6 w-48 animate-pulse rounded bg-ink-100" />
            ) : term ? (
              <>
                <p className="mt-1 text-lg font-semibold text-ink-950">{term.semester} · {term.academic_year}</p>
                <p className="mt-0.5 text-xs text-ink-500">Applications are always for the current semester.</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-danger-700">{NO_TERM_MESSAGE}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!term}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <DocumentUpload
            label="Certificate of Registration"
            value={cor}
            onChange={setCor}
            error={docErrors['cor']}
          />
          <DocumentUpload
            label="Grade Card"
            value={grades}
            onChange={setGrades}
            error={docErrors['grades']}
          />
          <DocumentUpload
            label="Letter of Intent"
            value={letterOfIntent}
            onChange={setLetterOfIntent}
            error={docErrors['letter_of_intent']}
          />
          <DocumentUpload
            label="2×2 Photo"
            accept=".jpg,.jpeg,.png"
            maxSizeMb={2}
            value={idPhoto}
            onChange={setIdPhoto}
            error={docErrors['id_photo']}
          />

          {serverError && (
            <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">
              {serverError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-5 py-3 text-sm font-semibold text-ink-900 hover:bg-ink-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={mutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              <Send className="h-4 w-4" />
              {mutation.isPending ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
