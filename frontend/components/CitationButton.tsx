'use client'

/**
 * CitationButton Component - Perplexity style inline citation
 */

import { Citation } from '@/lib/types'

interface Props {
  number: number;
  citation?: Citation;
}

export function CitationButton({ number, citation }: Props) {
  const index = number;
  const handleClick = () => {
    if (!citation) return;

    if (citation.pdfId && citation.pageNumber) {
      // Future: Open PDF viewer modal
      // For now, just open PDF in new tab
      window.open(citation.url, '_blank');
    } else {
      // Open web link
      window.open(citation.url, '_blank');
    }
  };

  if (!citation) {
    // Citation not loaded yet - show placeholder
    return (
      <sup className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 ml-0.5 text-xs font-semibold text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
        {index}
      </sup>
    );
  }

  return (
    <sup className="ml-0.5">
      <button
        onClick={handleClick}
        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold text-blue-600 dark:text-cyan-400 hover:text-white dark:hover:text-white bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 dark:hover:bg-cyan-600 rounded border border-blue-300 dark:border-blue-700 hover:border-blue-600 dark:hover:border-cyan-500 transition-all cursor-pointer shadow-sm hover:shadow"
        title={citation.title}
        aria-label={`Citation ${index}: ${citation.title}`}
      >
        {index}
      </button>
    </sup>
  );
}
