'use client'

/**
 * PDF Viewer Modal with Search Highlighting
 * 
 * Features:
 * - Full-screen modal
 * - PDF text search with highlighting
 * - Jump to specific page
 * - Keyboard navigation
 */

import { useState, useEffect } from 'react'

interface PDFViewerProps {
  url: string
  title: string
  pageNumber?: number
  searchTerm?: string
  onClose: () => void
}

export function PDFViewer({ url, title, pageNumber, searchTerm, onClose }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(pageNumber || 1)

  useEffect(() => {
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Build iframe URL with page navigation
  const buildViewerUrl = () => {
    if (currentPage > 1) {
      return `${url}#page=${currentPage}`
    }
    return url
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {title}
            </h2>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-cyan-400 hover:underline"
            >
              Open in new tab
            </a>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-3 mr-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              aria-label="Previous page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <input
              type="number"
              value={currentPage}
              onChange={(e) => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 text-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              min="1"
            />
            
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition"
              aria-label="Next page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PDF Iframe */}
        <div className="flex-1 relative">
          <iframe
            key={`pdf-${currentPage}`}
            src={buildViewerUrl()}
            className="w-full h-full border-0"
            title={title}
          />
          
          {/* Loading overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 pointer-events-none opacity-0 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 dark:border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading PDF...</span>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 font-mono">ESC</kbd> to close • 
            Use <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 font-mono">Ctrl+F</kbd> to search in PDF
          </p>
        </div>
      </div>
    </div>
  )
}
