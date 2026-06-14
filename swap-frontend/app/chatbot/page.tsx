import { ChatWindow } from '@/components/chatbot/ChatWindow'
import { MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function ChatbotPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-sm text-[#8A6A6A] hover:text-[#7D1A1A] transition-colors">← Home</Link>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#7D1A1A]" />
          <h1 className="text-xl font-bold text-[#1E293B]">SWAP Assistant</h1>
        </div>
      </div>
      <div className="h-[calc(100%-4rem)]">
        <ChatWindow />
      </div>
    </div>
  )
}
