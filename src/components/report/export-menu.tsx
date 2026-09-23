'use client'

import { useEffect, useRef, useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ChevronDown, Code2, Download, ExternalLink, FileJson, FileText, Image as ImageIcon, Link2, Palette, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BrandReport } from '@/lib/extractors/types'
import {
  generateCssVariables,
  generateCoolorsUrl,
  generateFontImport,
  generateGoogleFontsUrl,
  generateJsonExport,
  generateMarkdownReport,
  generateTailwindConfig,
} from '@/lib/export'
import { downloadBrandBoard, fileSlug } from '@/lib/client/brand-board'

function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const itemClass =
  'flex min-h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-slate-800 outline-none data-[highlighted]:bg-slate-100 data-[disabled]:opacity-50'

export function ExportMenu({ report }: { report: BrandReport }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
  }, [])

  const announce = (message: string) => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setStatus(message)
    clearTimer.current = setTimeout(() => setStatus(''), 4000)
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      announce(`${what} copied to clipboard`)
    } catch {
      announce(`Could not copy ${what}. Your browser blocked clipboard access.`)
    }
  }

  const brandBoard = async () => {
    if (busy) return
    setBusy(true)
    announce('Creating brand board image…')
    try {
      await downloadBrandBoard(report)
      announce('Brand board downloaded')
    } catch {
      announce('The brand board could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const googleFontsUrl = generateGoogleFontsUrl(report.typography.fonts)
  const slug = fileSlug(report.brandName)

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline" size="sm">
            <Download aria-hidden />
            Export
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={16} className="z-50 w-64 rounded-lg border bg-white p-1 shadow-lg">
            <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Report</DropdownMenu.Label>
            <DropdownMenu.Item className={itemClass} onSelect={() => window.open(`/api/pdf/${encodeURIComponent(report.id)}`, '_blank', 'noopener')}>
              <FileText className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Download PDF</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={itemClass}
              disabled={busy}
              onSelect={event => {
                event.preventDefault()
                void brandBoard()
              }}
            >
              <ImageIcon className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">{busy ? 'Creating brand board…' : 'Download brand board (PNG)'}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => copy(generateMarkdownReport(report), 'Markdown report')}>
              <Code2 className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Copy as Markdown</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => downloadFile(generateJsonExport(report), `${slug}-brand.json`, 'application/json')}>
              <FileJson className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Download JSON</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
            <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Colours</DropdownMenu.Label>
            <DropdownMenu.Item className={itemClass} onSelect={() => copy(generateTailwindConfig(report.colors.colors), 'Tailwind config')}>
              <Palette className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Copy Tailwind config</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => copy(generateCssVariables(report.colors.colors, report.typography.fonts), 'CSS variables')}>
              <Code2 className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Copy CSS variables</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => window.open(generateCoolorsUrl(report.colors.colors), '_blank', 'noopener')}>
              <ExternalLink className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Open in Coolors</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
            <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Fonts</DropdownMenu.Label>
            <DropdownMenu.Item
              className={itemClass}
              disabled={!googleFontsUrl}
              onSelect={() => googleFontsUrl && window.open(googleFontsUrl, '_blank', 'noopener')}
            >
              <Link2 className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">{googleFontsUrl ? 'Open Google Fonts' : 'No Google Fonts detected'}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => copy(generateFontImport(report.typography.fonts), 'font import')}>
              <Type className="size-4 text-slate-600" aria-hidden />
              <span className="flex-1">Copy CSS @import</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <p role="status" className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 empty:hidden">
        {status && <span className="block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">{status}</span>}
      </p>
    </>
  )
}
