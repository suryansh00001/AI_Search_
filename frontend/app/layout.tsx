import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '@/components/QueryProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Perplexity-Style AI Search',
  description: 'Streaming AI search with citations',
}

/**
 * Root Layout
 * 
 * NO "use client" needed here because:
 * - This is a Server Component by default
 * - Just renders HTML structure
 * - No interactivity, no hooks, no browser APIs
 * - Metadata can only be exported from Server Components
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
