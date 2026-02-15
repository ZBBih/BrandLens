'use client'

import { useState } from 'react'
import { tooltips, TooltipData } from '@/data/tooltips'

interface InfoTooltipProps {
  term: string
  children?: React.ReactNode
  className?: string
}

export function InfoTooltip({ term, children, className = '' }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const data = tooltips[term]

  if (!data) {
    return <>{children}</>
  }

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      {children}
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={`What is ${data.title}?`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-xl">
          <p className="font-semibold mb-1">{data.title}</p>
          <p className="text-slate-300 text-xs leading-relaxed">{data.description}</p>
          {data.learnMore && (
            <a
              href={data.learnMore}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Learn more →
            </a>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  )
}

interface TooltipWrapperProps {
  data: TooltipData
  children: React.ReactNode
  className?: string
}

export function TooltipWrapper({ data, children, className = '' }: TooltipWrapperProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      <span
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="cursor-help border-b border-dotted border-slate-400"
      >
        {children}
      </span>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-xl">
          <p className="font-semibold mb-1">{data.title}</p>
          <p className="text-slate-300 text-xs leading-relaxed">{data.description}</p>
          {data.learnMore && (
            <a
              href={data.learnMore}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Learn more →
            </a>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  )
}
