'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed && !disabled) {
        onSend(trimmed)
        setValue('')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-[#E2E8F0] p-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about SWAP eligibility, application steps…"
        rows={2}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-[#1B4F72] focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/20 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1B4F72] text-white hover:bg-[#2980B9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}
