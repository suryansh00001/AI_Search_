'use client'

/**
 * PDF Document Renderer
 * 
 * Uses PDF.js loaded from CDN to render PDF documents with:
 * - Zoom controls
 * - Page navigation
 * - Canvas-based rendering
 */

import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '@/lib/chat-store'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search, ChevronUp, ChevronDown } from 'lucide-react'

interface PDFDocumentProps {
  url: string
  initialPage?: number
  searchTerm?: string
}

// Global PDF.js types
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export function PDFDocument({ url, initialPage = 1, searchTerm }: PDFDocumentProps) {
  const { pdfViewer, setPdfPage, setPdfZoom, setPdfNumPages } = useChatStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState(searchTerm || '')
  const [showSearch, setShowSearch] = useState(false)
  const [searchMatches, setSearchMatches] = useState<any[]>([])
  const [currentMatch, setCurrentMatch] = useState(0)
  const [renderKey, setRenderKey] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  
  const currentPage = pdfViewer?.pageNumber || initialPage
  const zoom = pdfViewer?.zoom || 1.0
  const numPages = pdfViewer?.numPages || 0

  // Load PDF.js from CDN
  useEffect(() => {
    const loadPDFJS = () => {
      if (window.pdfjsLib) {
        console.log('✅ PDF.js already loaded')
        return Promise.resolve()
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.async = true
        
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          console.log('✅ PDF.js loaded from CDN')
          resolve(true)
        }
        
        script.onerror = () => {
          console.error('❌ Failed to load PDF.js')
          setError('Failed to load PDF.js library')
          reject(new Error('Failed to load PDF.js'))
        }
        
        document.head.appendChild(script)
      })
    }

    loadPDFJS().catch(err => {
      console.error('PDF.js load error:', err)
    })
  }, [])

  // Load PDF document
  useEffect(() => {
    const loadDocument = async () => {
      if (!url) return
      
      // Wait for PDF.js to be available
      let attempts = 0
      while (!window.pdfjsLib && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      if (!window.pdfjsLib) {
        setError('PDF.js library not loaded')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        console.log('📄 Loading PDF:', url)
        
        // Use proxy endpoint to avoid CORS issues
        const proxyUrl = `http://localhost:8000/api/pdf-proxy?url=${encodeURIComponent(url)}`
        console.log('🔄 Using proxy:', proxyUrl)
        
        const loadingTask = window.pdfjsLib.getDocument({
          url: proxyUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
          withCredentials: false,
        })
        
        loadingTask.onProgress = (progress: any) => {
          console.log(`Loading: ${progress.loaded} / ${progress.total}`)
        }
        
        const pdf = await loadingTask.promise
        
        setPdfDoc(pdf)
        setPdfNumPages(pdf.numPages)
        console.log('✅ PDF loaded:', pdf.numPages, 'pages')
        setLoading(false)
      } catch (err: any) {
        console.error('❌ PDF load error:', err)
        console.error('Error details:', { name: err?.name, message: err?.message })
        
        let errorMessage = 'Failed to load PDF'
        if (err?.message?.includes('CORS') || err?.message?.includes('fetch')) {
          errorMessage = 'CORS error: PDF URL does not allow cross-origin requests. Try using a CORS proxy or a different PDF.'
        } else if (err?.message) {
          errorMessage = err.message
        }
        
        setError(errorMessage)
        setLoading(false)
      }
    }

    loadDocument()
  }, [url, setPdfNumPages])

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return

      try {
        console.log('🎨 Rendering page', currentPage, 'at zoom', zoom)
        const page = await pdfDoc.getPage(currentPage)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context) {
          console.error('Failed to get canvas context')
          return
        }
        
        // Get viewport at the desired zoom level
        const viewport = page.getViewport({ scale: zoom * 1.5 })
        
        // Set canvas internal size to match viewport exactly
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        // Remove size constraints to allow scrolling
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }
        
        await page.render(renderContext).promise
        
        // Extract text for searching
        const textContent = await page.getTextContent()
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = ''
          textLayerRef.current.style.width = `${viewport.width}px`
          textLayerRef.current.style.height = `${viewport.height}px`
          
          textContent.items.forEach((item: any) => {
            // Apply viewport transform to get correct screen coordinates
            const tx = window.pdfjsLib.Util.transform(
              viewport.transform,
              item.transform
            )
            
            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3])
            
            const span = document.createElement('span')
            span.textContent = item.str
            span.style.position = 'absolute'
            span.style.left = `${tx[4]}px`
            span.style.top = `${tx[5] - (fontHeight * 0.7)}px`
            span.style.fontSize = `${fontHeight}px`
            span.style.fontFamily = 'sans-serif'
            span.style.lineHeight = '1'
            span.style.color = 'transparent'
            span.style.whiteSpace = 'pre'
            span.setAttribute('data-text', item.str)
            textLayerRef.current?.appendChild(span)
          })
        }
        
        console.log('✅ Rendered page', currentPage, 'at zoom', Math.round(zoom * 100) + '%')
        // Trigger highlighting to re-apply
        setRenderKey(prev => prev + 1)
      } catch (err) {
        console.error('❌ Page render error:', err)
      }
    }

    renderPage()
  }, [pdfDoc, currentPage, zoom])

  // Re-run search when zoom changes to update text layer
  useEffect(() => {
    if (searchQuery && searchMatches.length > 0) {
      // Trigger search re-run by clearing and re-setting
      const query = searchQuery
      setSearchQuery('')
      setTimeout(() => setSearchQuery(query), 10)
    }
  }, [zoom])

  // Search across all pages
  useEffect(() => {
    if (!searchQuery || !pdfDoc) {
      setSearchMatches([])
      return
    }

    const searchAllPages = async () => {
      const allMatches: Array<{ pageNum: number; text: string; element?: HTMLElement }> = []
      
      // Search through all pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum)
          const textContent = await page.getTextContent()
          
          textContent.items.forEach((item: any) => {
            const text = item.str || ''
            if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
              allMatches.push({
                pageNum,
                text,
                element: undefined // Will be populated when rendering that page
              })
            }
          })
        } catch (err) {
          console.error(`Error searching page ${pageNum}:`, err)
        }
      }
      
      setSearchMatches(allMatches)
      setCurrentMatch(0)
      
      if (allMatches.length > 0) {
        const pagesWithMatches = [...new Set(allMatches.map(m => m.pageNum))].join(', ')
        console.log(`🔍 Found ${allMatches.length} matches across pages: ${pagesWithMatches}`)
        
        // Navigate to first match if it's on a different page
        if (allMatches[0].pageNum !== currentPage) {
          setPdfPage(allMatches[0].pageNum)
        }
      }
    }
    
    searchAllPages()
  }, [searchQuery, pdfDoc, numPages])
  
  // Highlight matches on current page
  useEffect(() => {
    if (!textLayerRef.current) return
    
    const spans = Array.from(textLayerRef.current.querySelectorAll('span'))
    
    // Clear all highlights
    spans.forEach(span => {
      span.style.backgroundColor = ''
    })
    
    if (searchMatches.length === 0 || !searchQuery) return
    
    // Find which match indices are on the current page
    const currentPageMatchIndices: number[] = []
    searchMatches.forEach((match, index) => {
      if (match.pageNum === currentPage) {
        currentPageMatchIndices.push(index)
      }
    })
    
    if (currentPageMatchIndices.length === 0) return
    
    // Track which span corresponds to which match on this page
    let matchIndexOnPage = 0
    
    // Highlight matching spans
    spans.forEach(span => {
      const text = span.getAttribute('data-text') || ''
      if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
        const globalMatchIndex = currentPageMatchIndices[matchIndexOnPage]
        const isCurrentMatch = globalMatchIndex === currentMatch
        
        span.style.backgroundColor = isCurrentMatch 
          ? 'rgba(255, 165, 0, 0.5)' 
          : 'rgba(255, 255, 0, 0.4)'
        span.style.color = 'transparent'
        
        // Scroll to current match
        if (isCurrentMatch) {
          span.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        
        matchIndexOnPage++
      }
    })
  }, [searchQuery, searchMatches, currentMatch, currentPage, renderKey])

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return
    const nextIndex = (currentMatch + 1) % searchMatches.length
    const nextMatch = searchMatches[nextIndex]
    
    // Navigate to page if different
    if (nextMatch.pageNum !== currentPage) {
      setPdfPage(nextMatch.pageNum)
    }
    
    setCurrentMatch(nextIndex)
  }

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return
    const prevIndex = (currentMatch - 1 + searchMatches.length) % searchMatches.length
    const prevMatch = searchMatches[prevIndex]
    
    // Navigate to page if different
    if (prevMatch.pageNum !== currentPage) {
      setPdfPage(prevMatch.pageNum)
    }
    
    setCurrentMatch(prevIndex)
  }

  const handleZoomIn = () => {
    setPdfZoom(Math.min(zoom + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setPdfZoom(Math.max(zoom - 0.2, 0.5))
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setPdfPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setPdfPage(currentPage + 1)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-3">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[80px] text-center">
              {numPages > 0 ? `${currentPage} / ${numPages}` : 'Loading...'}
            </span>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Center Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3.0}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        {showSearch && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in document..."
                className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchMatches.length > 0 && (
                <>
                  <button
                    onClick={handlePrevMatch}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Previous match"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {currentMatch + 1} / {searchMatches.length}
                  </span>
                  <button
                    onClick={handleNextMatch}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Next match"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* PDF Viewer - Canvas-based rendering */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950">
        <div className="p-4 inline-block min-w-full">
          {error ? (
            <div className="text-red-500 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="shadow-lg"
              />
              <div
                ref={textLayerRef}
                className="absolute top-0 left-0 pointer-events-none overflow-hidden"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
