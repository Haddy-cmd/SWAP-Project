'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, RefreshCw } from 'lucide-react'
import { nanoid } from 'nanoid'
import { ChatMessage, type Message } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { chatbotApi } from '@/lib/api/chatbot.api'

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hi! I'm the SWAP Assistant. I can answer questions about the Student Welfare Assistantship Program — eligibility, application steps, service hours, stipends, and more. How can I help you?",
  timestamp: new Date(),
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const bottomRef = useRef<HTMLDivElement>(null)

  const ask = useMutation({
    mutationFn: (query: string) => chatbotApi.query(query).then((data) => ({ data })),
    onMutate: (query) => {
      const userMsg: Message = {
        id: nanoid(),
        role: 'user',
        content: query,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
    },
    onSuccess: (res) => {
      const botMsg: Message = {
        id: nanoid(),
        role: 'assistant',
        content: res.data?.answer ?? "Sorry, I couldn't understand that.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMsg])
    },
    onError: () => {
      const errMsg: Message = {
        id: nanoid(),
        role: 'assistant',
        content: "Sorry, I couldn't process your request. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errMsg])
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleReset() {
    setMessages([{ ...GREETING, id: nanoid(), timestamp: new Date() }])
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B4F72]">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">SWAP Assistant</p>
            <p className="text-xs text-[#27AE60]">● Online</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="rounded-lg p-2 text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          title="Reset conversation"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {ask.isPending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EBF5FB]">
              <Bot className="h-4 w-4 text-[#1B4F72]" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#F1F5F9] px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#94A3B8]" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#94A3B8]" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#94A3B8]" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(q) => ask.mutate(q)} disabled={ask.isPending} />
    </div>
  )
}
