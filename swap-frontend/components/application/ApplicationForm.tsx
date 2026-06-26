'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Send } from 'lucide-react'
import { DocumentUpload } from './DocumentUpload'
import { applicationsApi } from '@/lib/api/applications.api'
import type { ApiError } from '@/types/api.types'

const ACADEMIC_YEARS = ['2024-2025', '2025-2026', '2026-2027']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const step1Schema = z.object({
  academic_year: z.string().min(1, 'Required'),
  semester: z.string().min(1, 'Required'),
})

type Step1Data = z.infer<typeof step1Schema>

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

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<Step1Data>({ resolver: zodResolver(step1Schema) })

  const mutation = useMutation({
    mutationFn: async () => {
      const values = getValues()
      const application = await applicationsApi.submitApplication({
        academic_year: values.academic_year,
        semester: values.semester,
      })
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
      queryClient.invalidateQueries({ queryKey: ['applications'] })
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

  function onStep1(data: Step1Data) {
    void data
    setStep(2)
  }

  function onSubmit() {
    if (!validateDocs()) return
    setServerError(null)
    mutation.mutate()
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
                  ? 'bg-[#7D1A1A] text-white'
                  : s < step
                  ? 'bg-[#27AE60] text-white'
                  : 'bg-[#EAD9D9] text-[#8A6A6A]'
              }`}
            >
              {s}
            </div>
            {s < 2 && (
              <div
                className={`h-0.5 w-16 rounded ${s < step ? 'bg-[#27AE60]' : 'bg-[#EAD9D9]'}`}
              />
            )}
          </div>
        ))}
        <div className="ml-2 text-sm font-medium text-[#8A6A6A]">
          {step === 1 ? 'Application Info' : 'Supporting Documents'}
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={handleSubmit(onStep1)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
              Academic Year
            </label>
            <select
              {...register('academic_year')}
              className="w-full rounded-lg border border-[#DCC5C5] bg-white px-3 py-2.5 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15"
            >
              <option value="">Select academic year</option>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {errors.academic_year && (
              <p className="mt-1 text-xs text-[#E74C3C]">{errors.academic_year.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
              Semester
            </label>
            <select
              {...register('semester')}
              className="w-full rounded-lg border border-[#DCC5C5] bg-white px-3 py-2.5 text-sm text-[#1E293B] focus:border-[#7D1A1A] focus:outline-none focus:ring-2 focus:ring-[#7D1A1A]/15"
            >
              <option value="">Select semester</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.semester && (
              <p className="mt-1 text-xs text-[#E74C3C]">{errors.semester.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </form>
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
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#E74C3C]">
              {serverError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-[#DCC5C5] bg-white px-5 py-3 text-sm font-semibold text-[#1E293B] hover:bg-[#FAF7F7] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={mutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7D1A1A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A52020] disabled:opacity-60 transition-colors"
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
