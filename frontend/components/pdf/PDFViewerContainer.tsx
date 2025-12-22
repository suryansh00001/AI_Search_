'use client'

/**
 * PDF Viewer Container with Split Layout
 * 
 * Provides animated transition from full-width chat to split view
 * - Left: Chat (60% width)
 * - Right: PDF Viewer (40% width)
 * - Smooth slide-in animation using framer-motion
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/lib/chat-store'
import { X } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with PDF.js
const PDFDocument = dynamic(
  () => import('./PDFDocument').then(mod => ({ default: mod.PDFDocument })),
  { ssr: false }
)

export function PDFViewerContainer({ children }: { children: React.ReactNode }) {
  const { pdfViewer, closePdfViewer } = useChatStore()
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Chat Container - Shrinks when PDF opens on large screens, hidden on mobile when PDF is open */}
      <motion.div
        className={`flex-1 overflow-y-auto ${pdfViewer?.isOpen ? 'hidden lg:block' : 'block'}`}
        animate={{
          width: pdfViewer?.isOpen ? '60%' : '100%'
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut'
        }}
      >
        {children}
      </motion.div>
      
      {/* PDF Viewer - Full screen on mobile, 40% width on large screens */}
      <AnimatePresence>
        {pdfViewer?.isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: 'easeInOut'
            }}
            className="w-full lg:w-[40%] h-screen border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col absolute lg:relative inset-0 lg:inset-auto z-50 lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {pdfViewer.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {pdfViewer.url}
                </p>
              </div>
              <button
                onClick={closePdfViewer}
                className="ml-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close PDF viewer"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            {/* PDF Document */}
            <div className="flex-1 overflow-hidden">
              <PDFDocument
                url={pdfViewer.url}
                initialPage={pdfViewer.pageNumber}
                searchTerm={pdfViewer.searchTerm}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
