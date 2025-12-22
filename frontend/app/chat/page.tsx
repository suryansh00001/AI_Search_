'use client'

/**
 * Chat Page - Refactored with Zustand + React Query
 * 
 * State Management:
 * - Zustand: Global chat state (messages, PDF viewer)
 * - React Query: API requests and SSE streaming
 */

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useChatStore } from '@/lib/chat-store'
import { useStreamChatDirect } from '@/lib/chat-api'
import { MessageDisplay } from '@/components/MessageDisplay'
import { DarkModeToggle } from '@/components/DarkModeToggle'

// Dynamic import to avoid SSR issues with PDF.js
const PDFViewerContainer = dynamic(
  () => import('@/components/pdf/PDFViewerContainer').then(mod => ({ default: mod.PDFViewerContainer })),
  { ssr: false }
)

export default function ChatPage() {
  const { messages, isStreaming, pdfViewer, addMessage, closePdfViewer, openPdfViewer } = useChatStore()
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Use React Query for streaming
  const { mutate: startStreaming } = useStreamChatDirect()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const query = input.trim()
    const messageId = addMessage(query)
    setInput('')

    // Start streaming using React Query
    startStreaming({ messageId, query })
  }
  
  // Test PDF viewer with a public PDF
  const testPdfViewer = () => {
    // Using arXiv PDF to test proxy functionality
    openPdfViewer(
      'https://arxiv.org/pdf/2103.00020.pdf',
      'Test PDF - arXiv Paper',
      1
    )
  }

  // Auto-focus input after streaming completes
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus()
    }
  }, [isStreaming])

  return (
    <PDFViewerContainer>
      <div className="flex flex-col h-screen bg-white dark:bg-[#0f0f0f]">
        {/* Header - Perplexity style */}
        <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between backdrop-blur-sm bg-white/80 dark:bg-[#0f0f0f]/80 sticky top-0 z-10">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            AI Search
          </h1>
          <div className="flex items-center gap-3">
            {/* Test PDF Button */}
            <button
              onClick={testPdfViewer}
              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Test PDF
            </button>
            <DarkModeToggle />
          </div>
        </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
          {messages.length === 0 && (
            <div className="text-center mt-32">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
                Ask me anything
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                I'll search the web and provide sourced answers
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageDisplay key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isStreaming}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isStreaming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Thinking...
                </>
              ) : (
                <>
                  Send
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      </div>
    </PDFViewerContainer>
  )
}
