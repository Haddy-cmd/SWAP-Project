import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { EchoProvider } from '@/lib/providers/EchoProvider'
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SWAP Portal — MSU Marawi',
  description:
    'Digital Monitoring and Application System for the Student Welfare Assistantship Program at Mindanao State University — Marawi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <EchoProvider>{children}</EchoProvider>
          <ChatbotWidget />
        </QueryProvider>
      </body>
    </html>
  )
}
