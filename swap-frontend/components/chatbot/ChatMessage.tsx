import { Bot, LifeBuoy, User } from 'lucide-react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  /** The question this reply answers, so it can be sent on to the DSA if it missed. */
  handoff?: string
}

interface ChatMessageProps {
  message: Message
  /** Send an unanswered question to the DSA (signed-in non-admins only). */
  onHandoff?: (question: string) => void
}

export function ChatMessage({ message, onHandoff }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-brand-700' : 'bg-brand-50'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-brand-700" />
        )}
      </div>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-brand-700 text-white'
            : 'rounded-tl-sm bg-ink-100 text-ink-900'
        }`}
      >
        {message.content}
        {message.handoff && onHandoff && (
          <button onClick={() => onHandoff(message.handoff!)}
            className="mt-2 flex items-center gap-1 border-t border-ink-200 pt-1.5 text-[11.5px] font-semibold text-brand-700 hover:underline">
            <LifeBuoy className="h-3 w-3" /> Not answered? Send this to the DSA
          </button>
        )}
      </div>
    </div>
  )
}
