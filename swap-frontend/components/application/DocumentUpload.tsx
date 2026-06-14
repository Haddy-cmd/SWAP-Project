'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload, X, FileText, CheckCircle } from 'lucide-react'

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

  function handleFile(file: File | undefined | null) {
    if (!file) return
    if (file.size > maxSizeMb * 1024 * 1024) {
      onChange(null)
      return
    }
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
      <label className="block text-sm font-medium text-[#1E293B]">{label}</label>

      {!value ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
            dragging
              ? 'border-[#7D1A1A] bg-[#FEF0F0]'
              : error
              ? 'border-[#E74C3C] bg-red-50'
              : 'border-[#DCC5C5] bg-[#FAF7F7] hover:border-[#7D1A1A] hover:bg-[#FEF0F0]'
          }`}
        >
          <Upload
            className={`h-7 w-7 ${error ? 'text-[#E74C3C]' : 'text-[#B09A9A]'}`}
          />
          <div className="text-center">
            <p className="text-sm font-medium text-[#1E293B]">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-[#8A6A6A]">
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
        <div className="flex items-center justify-between rounded-xl border border-[#27AE60] bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-[#27AE60]" />
            <FileText className="h-4 w-4 flex-shrink-0 text-[#8A6A6A]" />
            <span className="truncate text-sm font-medium text-[#1E293B]">{value.name}</span>
            <span className="text-xs text-[#8A6A6A]">
              ({(value.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-2 flex-shrink-0 rounded-full p-1 text-[#8A6A6A] hover:bg-red-100 hover:text-[#E74C3C] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#E74C3C]">{error}</p>}
    </div>
  )
}
