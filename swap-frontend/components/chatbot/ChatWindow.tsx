'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, RefreshCw, X, LifeBuoy } from 'lucide-react'
import { nanoid } from 'nanoid'
import { ChatMessage, type Message } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { DsaConcernsPanel } from './DsaConcernsPanel'
import { chatbotApi } from '@/lib/api/chatbot.api'
import { useAuthStore } from '@/lib/store/authStore'
import { useUIStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/utils/cn'

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hi! I'm the SWAP Assistant. I can answer questions about the Student Welfare Assistantship Program — eligibility, applying, interviews, clocking in and out, service hours, duty slips, claim stubs, promissory notes, and more. If you need a person, you can also write to the DSA Office. How can I help you?",
  timestamp: new Date(),
}

export function ChatWindow({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const listRef = useRef<HTMLDivElement>(null)

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
    onSuccess: (res, query) => {
      const botMsg: Message = {
        id: nanoid(),
        role: 'assistant',
        content: res.data?.answer ?? "Sorry, I couldn't understand that.",
        timestamp: new Date(),
        // Any answer can miss the point: offer to send the question on to the DSA.
        handoff: query,
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

  // Scroll only the message list itself — scrollIntoView would also scroll
  // every ancestor, yanking the whole page down when the widget is open.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Signed-in non-admins write to the DSA from the Ask the DSA tab; admins answer
  // from Admin → Concerns, and visitors get the DSA email.
  const role = useAuthStore((s) => s.user?.role)
  const canAskDsa = !!role && role !== 'admin'
  const { chatTab, setChatTab, setDsaDraft } = useUIStore()
  const tab = canAskDsa ? chatTab : 'assistant'

  // Coming back from Ask the DSA: show the latest message again.
  useEffect(() => {
    const el = listRef.current
    if (tab === 'assistant' && el) el.scrollTo({ top: el.scrollHeight })
  }, [tab])

  const handOff = (question: string) => {
    setDsaDraft({ subject: question.length > 80 ? `${question.slice(0, 77)}…` : question, message: question })
    setChatTab('dsa')
  }

  function handleReset() {
    setMessages([{ ...GREETING, id: nanoid(), timestamp: new Date() }])
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">SWAP Assistant</p>
            <p className="text-xs text-success-600">● Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-brand-700 transition-colors"
            title="Reset conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-brand-700 transition-colors"
              title="Close"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs: the assistant, or writing to the DSA Office */}
      {canAskDsa && (
        <div className="flex gap-1 border-b border-ink-100 bg-ink-50 px-3 py-2" role="tablist" aria-label="Chat">
          {([['assistant', 'Assistant', Bot], ['dsa', 'Ask the DSA', LifeBuoy]] as const).map(([value, label, Icon]) => (
            <button key={value} role="tab" aria-selected={tab === value} onClick={() => setChatTab(value)}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
                tab === value ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-500 hover:text-brand-700')}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'dsa' ? (
        <DsaConcernsPanel />
      ) : (
      <>
      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} onHandoff={canAskDsa ? handOff : undefined} />
        ))}
        {ask.isPending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50">
              <Bot className="h-4 w-4 text-brand-700" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-ink-100 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Hand-off to a person: the Ask the DSA tab (signed in) or the DSA email (visitors). */}
      {role !== 'admin' && (
        <div className="border-t border-ink-100 px-5 py-2 text-center text-xs text-ink-500">
          {canAskDsa ? (
            <button onClick={() => setChatTab('dsa')} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              <LifeBuoy className="h-3.5 w-3.5" /> Ask the DSA directly
            </button>
          ) : (
            <>Need a person? Email <a href="mailto:dsa@msumain.edu.ph" className="font-semibold text-brand-700 hover:underline">dsa@msumain.edu.ph</a></>
          )}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={(q) => ask.mutate(q)} disabled={ask.isPending} />
      </>
      )}
    </div>
  )
}
