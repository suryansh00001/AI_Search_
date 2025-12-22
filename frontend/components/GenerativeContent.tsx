'use client'

/**
 * Generative Content Component
 * 
 * Dynamically renders rich UI elements from AI responses:
 * - Tables (from markdown or structured data)
 * - Charts (bar, line, pie charts)
 * - Code blocks with syntax highlighting
 * - Rich markdown with GFM support
 * - Cards and structured data displays
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'

interface GenerativeContentProps {
  content: string
  structuredData?: StructuredData | StructuredData[]
}

interface StructuredData {
  type: 'chart' | 'table' | 'card' | 'list'
  data: any
  config?: any
}

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
  '#10b981', '#06b6d4', '#f43f5e', '#6366f1'
]

export function GenerativeContent({ content, structuredData }: GenerativeContentProps) {
  console.log('GenerativeContent render:', { 
    hasContent: !!content, 
    hasStructuredData: !!structuredData, 
    structuredDataCount: Array.isArray(structuredData) ? structuredData.length : (structuredData ? 1 : 0)
  })
  
  return (
    <div className="space-y-4">
      {/* Structured Data Rendering (Charts, Tables, etc.) */}
      {structuredData && (
        <div className="my-6 space-y-6">
          {Array.isArray(structuredData) ? (
            structuredData.map((item, index) => {
              // Create stable key from data content to prevent re-initialization
              const stableKey = `${item.type}-${item.config?.title || index}-${JSON.stringify(item.data).substring(0, 50)}`
              return <div key={stableKey}>{renderStructuredData(item)}</div>
            })
          ) : (
            renderStructuredData(structuredData)
          )}
        </div>
      )}

      {/* Markdown Content with Rich Formatting */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Code blocks with syntax highlighting
          code({node, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const inline = !match
            
            return !inline && match ? (
              <div className="my-4 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    {match[1]}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(codeString)}
                    className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark as any}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '0.875rem',
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-pink-600 dark:text-pink-400" {...props}>
                {children}
              </code>
            )
          },
          
          // Enhanced tables
          table({children}) {
            return (
              <div className="my-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  {children}
                </table>
              </div>
            )
          },
          
          thead({children}) {
            return (
              <thead className="bg-gray-50 dark:bg-gray-900">
                {children}
              </thead>
            )
          },
          
          th({children}) {
            return (
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {children}
              </th>
            )
          },
          
          td({children}) {
            return (
              <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-800">
                {children}
              </td>
            )
          },
          
          // Blockquotes
          blockquote({children}) {
            return (
              <blockquote className="my-4 pl-4 border-l-4 border-blue-500 dark:border-cyan-400 italic text-gray-700 dark:text-gray-300">
                {children}
              </blockquote>
            )
          },
          
          // Links
          a({href, children}) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-cyan-400 hover:underline"
              >
                {children}
              </a>
            )
          },
          
          // Headings
          h1({children}) {
            return <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-4">{children}</h1>
          },
          h2({children}) {
            return <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-5 mb-3">{children}</h2>
          },
          h3({children}) {
            return <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">{children}</h3>
          },
          
          // Lists
          ul({children}) {
            return <ul className="list-disc list-inside space-y-1 text-gray-800 dark:text-gray-200 my-3">{children}</ul>
          },
          ol({children}) {
            return <ol className="list-decimal list-inside space-y-1 text-gray-800 dark:text-gray-200 my-3">{children}</ol>
          },
          
          // Paragraphs
          p({children}) {
            return <p className="text-gray-800 dark:text-gray-200 leading-relaxed my-2">{children}</p>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function renderStructuredData(data: StructuredData) {
  console.log('renderStructuredData called:', data)
  
  switch (data.type) {
    case 'chart':
      return <ChartRenderer data={data.data} config={data.config} />
    case 'table':
      return <TableRenderer data={data.data} />
    case 'card':
      return <CardRenderer data={data.data} />
    case 'list':
      return <ListRenderer data={data.data} />
    default:
      console.warn('Unknown structured data type:', data.type)
      return null
  }
}

// Chart Renderer for various chart types (memoized to prevent re-renders)
const ChartRenderer = React.memo<{ data: any[], config?: any }>(({ data, config }) => {
  console.log('ChartRenderer:', { data, config })
  
  const chartType = config?.type || 'bar'
  
  if (!data || data.length === 0) {
    console.warn('ChartRenderer: No data provided')
    return <div className="text-red-500">No chart data available</div>
  }
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      {config?.title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {config.title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={config?.xKey || 'name'} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                color: '#f9fafb'
              }} 
            />
            <Legend />
            <Bar dataKey={config?.yKey || 'value'} fill={CHART_COLORS[0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={config?.xKey || 'name'} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                color: '#f9fafb'
              }} 
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={config?.yKey || 'value'} 
              stroke={CHART_COLORS[0]} 
              strokeWidth={2}
            />
          </LineChart>
        ) : chartType === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey={config?.yKey || 'value'}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                color: '#f9fafb'
              }} 
            />
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  )
})

ChartRenderer.displayName = 'ChartRenderer'

// Table Renderer for structured data tables
function TableRenderer({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null
  
  const headers = Object.keys(data[0])
  
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900">
              {headers.map((header) => (
                <td
                  key={header}
                  className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200"
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Card Renderer for info cards
function CardRenderer({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(data).map(([key, value]) => (
        <div
          key={key}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-blue-200 dark:border-gray-700 p-6"
        >
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
            {key}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {String(value)}
          </div>
        </div>
      ))}
    </div>
  )
}

// List Renderer for structured lists
function ListRenderer({ data }: { data: string[] | any[] }) {
  return (
    <div className="space-y-2">
      {data.map((item, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800"
        >
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 dark:bg-cyan-400 flex items-center justify-center text-white text-xs font-bold">
            {idx + 1}
          </div>
          <div className="flex-1 text-gray-800 dark:text-gray-200">
            {typeof item === 'string' ? item : JSON.stringify(item)}
          </div>
        </div>
      ))}
    </div>
  )
}
