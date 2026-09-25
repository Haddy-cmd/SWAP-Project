import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Newsreader } from 'next/font/google'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { EchoProvider } from '@/lib/providers/EchoProvider'
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget'
import '@/app/globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap' })

export const metadata: Metadata = {
  title: 'SWAP Portal — MSU Marawi',
  description:
    'Digital Monitoring and Application System for the Student Welfare Assistantship Program at Mindanao State University — Marawi',
}

// Browser UI tint (mobile address bar) in the seal's deep green.
export const viewport: Viewport = {
  themeColor: '#10331F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${newsreader.variable} font-sans`} suppressHydrationWarning>
        <QueryProvider>
          <EchoProvider>{children}</EchoProvider>
          <ChatbotWidget />
        </QueryProvider>
      </body>
    </html>
  )
}
