'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandReport } from '@/lib/extractors/types'
import {
  generateTailwindConfig,
  generateCssVariables,
  generateCoolorsUrl,
  generateGoogleFontsUrl,
  generateFontImport,
  generateMarkdownReport,
  generateJsonExport,
} from '@/lib/export'

interface ExportDropdownProps {
  report: BrandReport
  variant?: 'colors' | 'fonts' | 'full'
}

interface ExportOption {
  label: string
  icon: React.ReactNode
  action: () => void | Promise<void>
  external?: boolean
}

export function ExportDropdown({ report, variant = 'full' }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const colorOptions: ExportOption[] = [
    {
      label: 'Tailwind Config',
      icon: <TailwindIcon />,
      action: () => copyToClipboard(generateTailwindConfig(report.colors.colors), 'Tailwind Config'),
    },
    {
      label: 'CSS Variables',
      icon: <CssIcon />,
      action: () => copyToClipboard(
        generateCssVariables(report.colors.colors, report.typography.fonts),
        'CSS Variables'
      ),
    },
    {
      label: 'Open in Coolors',
      icon: <ExternalIcon />,
      action: () => { window.open(generateCoolorsUrl(report.colors.colors), '_blank') },
      external: true,
    },
  ]

  const fontOptions: ExportOption[] = [
    {
      label: 'Google Fonts Link',
      icon: <LinkIcon />,
      action: () => {
        const url = generateGoogleFontsUrl(report.typography.fonts)
        if (url) window.open(url, '_blank')
      },
      external: true,
    },
    {
      label: 'CSS @import',
      icon: <CssIcon />,
      action: () => copyToClipboard(generateFontImport(report.typography.fonts), 'CSS @import'),
    },
  ]

  const fullOptions: ExportOption[] = [
    {
      label: 'Download PDF',
      icon: <PdfIcon />,
      action: () => { window.open(`/api/pdf/${report.id}`, '_blank') },
      external: true,
    },
    {
      label: 'Copy as Markdown',
      icon: <MarkdownIcon />,
      action: () => copyToClipboard(generateMarkdownReport(report), 'Markdown'),
    },
    {
      label: 'Download JSON',
      icon: <JsonIcon />,
      action: () => downloadFile(
        generateJsonExport(report),
        `${report.brandName.toLowerCase().replace(/\s+/g, '-')}-brand.json`,
        'application/json'
      ),
    },
    ...colorOptions,
    ...fontOptions,
  ]

  const options = variant === 'colors' ? colorOptions : variant === 'fonts' ? fontOptions : fullOptions

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Export
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-50 py-2">
            {options.map((option, i) => (
              <button
                key={i}
                onClick={() => {
                  option.action()
                  if (!option.external) {
                    setTimeout(() => setIsOpen(false), 500)
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="w-5 h-5 text-slate-400">{option.icon}</span>
                <span className="flex-1 text-left">{option.label}</span>
                {copied === option.label && (
                  <span className="text-green-500 text-xs">Copied!</span>
                )}
                {option.external && (
                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Icons
function TailwindIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"/>
    </svg>
  )
}

function CssIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8M8 12h6M8 16h4" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <path d="M10 12h4M10 16h4M8 12h.01M8 16h.01" />
    </svg>
  )
}

function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 4H2v16h20V4zM4 18V6h16v12H4zm3-2h2v-4l1.5 2 1.5-2v4h2v-6h-2l-1.5 2-1.5-2H7v6zm10-3v3h-2v-3h-2l3-3 3 3h-2z"/>
    </svg>
  )
}

function JsonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 3H7a2 2 0 00-2 2v14a2 2 0 002 2h1M16 3h1a2 2 0 012 2v14a2 2 0 01-2 2h-1" />
      <path d="M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3" />
    </svg>
  )
}
