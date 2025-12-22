'use client'

import { Search, FileText, Sparkles } from 'lucide-react'

/**
 * ToolIndicator Component - Perplexity style
 */

interface Props {
  tool: string;
  message: string;
}

const toolConfig = {
  web_search: { 
    icon: Search, 
    label: 'Searching', 
    gradient: 'from-blue-500 to-cyan-400'
  },
  reading_pdf: { 
    icon: FileText, 
    label: 'Reading PDF', 
    gradient: 'from-purple-500 to-pink-400'
  },
  synthesizing_answer: { 
    icon: Sparkles, 
    label: 'Thinking', 
    gradient: 'from-green-500 to-emerald-400'
  },
};

export function ToolIndicator({ tool, message }: Props) {
  const config = toolConfig[tool as keyof typeof toolConfig] || {
    icon: Sparkles,
    label: tool,
    gradient: 'from-gray-500 to-gray-400',
  };

  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center animate-pulse`}>
        <IconComponent className="w-4 h-4 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {config.label}
        </span>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
