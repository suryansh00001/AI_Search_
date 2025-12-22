'use client'

/**
 * Message Display Component
 * 
 * Displays a single message with:
 * - User query
 * - AI response
 * - Tool indicators
 * - Citations
 * 
 * Uses Zustand store for state
 */

import { Message, useChatStore } from '@/lib/chat-store'
import { ToolIndicator } from './ToolIndicator'
import { CitationButton } from './CitationButton'
import { GenerativeContent } from './GenerativeContent'
import { User, Bot } from 'lucide-react'

interface Props {
  message: Message
}

export function MessageDisplay({ message }: Props) {
  const { openPdfViewer } = useChatStore()

  // Parse content and replace [1], [2], [3] with citation buttons
  const renderContent = () => {
    if (!message.content) return null

    const parts = message.content.split(/(\[\d+\])/)
    
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/)
      if (match) {
        const num = parseInt(match[1])
        const citation = message.citations.get(num)
        return (
          <CitationButton 
            key={i}
            number={num}
            citation={citation}
          />
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const handleCitationClick = (citation: any) => {
    const isPDF = citation.url.toLowerCase().endsWith('.pdf') || citation.pdfId
    if (isPDF) {
      openPdfViewer(citation.url, citation.title, citation.pageNumber)
    }
  }

  return (
    <div className="space-y-6">
      {/* User Query */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 pt-1">
          <p className="text-gray-900 dark:text-white">{message.query}</p>
        </div>
      </div>

      {/* AI Response */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-4">
          {/* Tool Indicator */}
          {message.activeTool && (
            <ToolIndicator
              tool={message.activeTool.tool}
              message={message.activeTool.message}
            />
          )}

          {/* Error Display */}
          {message.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-200">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">Error</span>
              </div>
              <p className="text-sm">{message.error}</p>
            </div>
          )}

          {/* Streaming Content */}
          {message.content && !message.error && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              {/* Use GenerativeContent component for rich rendering */}
              <GenerativeContent 
                content={message.content}
                structuredData={message.structuredData}
              />
            </div>
          )}

          {/* Loading Cursor */}
          {!message.isComplete && message.content && (
            <span className="inline-block w-0.5 h-5 bg-blue-500 dark:bg-cyan-400 animate-pulse ml-1" />
          )}

          {/* Citations List */}
          {message.citations.size > 0 && message.isComplete && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase tracking-wider">
                Sources
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {Array.from(message.citations.values()).map((citation) => {
                  const isPDF = citation.url.toLowerCase().endsWith('.pdf') || citation.pdfId
                  
                  const handleClick = (e: React.MouseEvent) => {
                    if (isPDF) {
                      e.preventDefault()
                      handleCitationClick(citation)
                    }
                  }
                  
                  return (
                    <a
                      key={citation.index}
                      href={citation.url}
                      onClick={handleClick}
                      target={isPDF ? undefined : "_blank"}
                      rel={isPDF ? undefined : "noopener noreferrer"}
                      className="group flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-cyan-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {citation.index}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                            {citation.title}
                          </div>
                          {isPDF && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                              PDF
                            </span>
                          )}
                          {citation.pageNumber && (
                            <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                              p.{citation.pageNumber}
                            </span>
                          )}
                        </div>
                        {citation.snippet && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {citation.snippet}
                          </p>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                          {new URL(citation.url).hostname}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-cyan-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isPDF ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"} />
                      </svg>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
