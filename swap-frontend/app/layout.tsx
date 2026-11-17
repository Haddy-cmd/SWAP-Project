import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Newsreader } from 'next/font/google'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget'
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider'
import { LoginSplash } from '@/components/layout/LoginSplash'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { UploadProgress } from '@/components/feedback/UploadProgress'
import { Suspense } from 'react'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { BROWSER_CHECK_SCRIPT } from '@/lib/browserSupport'
import { BrowserNotice } from '@/components/layout/BrowserNotice'
import '@/app/globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap' })

export const metadata: Metadata = {
  title: 'SWAP Portal — MSU Marawi',
  description:
    'Digital Monitoring and Application System for the Student Welfare Assistantship Program at Mindanao State University — Marawi',
}

// Browser UI tint (mobile address bar): the seal's deep green, darker in dark mode.
export const viewport: Viewport = {
  // Phones render at their own width, app-like: pinch and double-tap zoom are off (Chrome's
  // "Force enable zoom" accessibility setting still overrides it). viewport-fit lets the safe-area insets apply.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10331F' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1A12' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set before paint by the script below (lib/theme.ts), so React must not touch it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BROWSER_CHECK_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${jakarta.variable} ${newsreader.variable} font-sans`} suppressHydrationWarning>
        <BrowserNotice />
        {/* Gold bar at the top while the next page loads (reads the URL, so it needs a Suspense boundary). */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <QueryProvider>
          {/* Action pop-outs and "Are you sure?" dialogs for every page (useFeedback). */}
          <FeedbackProvider>
            {children}
            {/* The DSA-seal intro right after a sign-in (any role). */}
            <LoginSplash />
            <ChatbotWidget />
            {/* "Uploading file.pdf… 42%" while any upload takes a moment. */}
            <UploadProgress />
          </FeedbackProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
