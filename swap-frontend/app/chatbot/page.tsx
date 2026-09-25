import { ChatWindow } from '@/components/chatbot/ChatWindow'
import { MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function ChatbotPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-sm text-ink-500 hover:text-brand-700 transition-colors">← Home</Link>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand-700" />
          <h1 className="text-xl font-bold text-ink-900">SWAP Assistant</h1>
        </div>
      </div>
      <div className="h-[calc(100%-4rem)]">
        <ChatWindow />
      </div>
    </div>
  )
}
