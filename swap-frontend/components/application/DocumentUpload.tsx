'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react'

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

interface DocumentUploadProps {
  label: string
  accept?: string
  maxSizeMb?: number
  value?: File | null
  onChange: (file: File | null) => void
  error?: string
}

export function DocumentUpload({
  label,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMb = 5,
  value,
  onChange,
  error,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  // Why the picked file wasn't taken (too big, or a type the field doesn't accept).
  const [warning, setWarning] = useState<string | null>(null)

  function handleFile(file: File | undefined | null) {
    if (!file) return
    const allowed = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
    // Dropped files skip the picker's filter, so the type is checked here too.
    if (allowed.length && !allowed.includes(ext)) {
      setWarning(`${file.name} can't be used here. ${label} must be ${allowed.join(', ')}.`)
      onChange(null)
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setWarning(`That file is ${mb(file.size)}. ${label} must be ${maxSizeMb} MB or smaller.`)
      onChange(null)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setWarning(null)
    onChange(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleRemove() {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink-900">{label}</label>

      {!value ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
            dragging
              ? 'border-brand-700 bg-brand-50'
              : error || warning
              ? 'border-danger-600 bg-danger-50'
              : 'border-ink-300 bg-ink-50 hover:border-brand-700 hover:bg-brand-50'
          }`}
        >
          <Upload
            className={`h-7 w-7 ${error || warning ? 'text-danger-600' : 'text-ink-400'}`}
          />
          <div className="text-center">
            <p className="text-sm font-medium text-ink-900">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-ink-500">
              {accept.replaceAll(',', ', ')} · max {maxSizeMb}MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleChange}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-success-600 bg-success-50 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-success-600" />
            <FileText className="h-4 w-4 flex-shrink-0 text-ink-500" />
            <span className="truncate text-sm font-medium text-ink-900">{value.name}</span>
            <span className="text-xs text-ink-500">
              ({(value.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-2 flex-shrink-0 rounded-full p-1 text-ink-500 hover:bg-danger-100 hover:text-danger-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {warning && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger-600">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none" /> {warning}
        </p>
      )}
      {error && !warning && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}
